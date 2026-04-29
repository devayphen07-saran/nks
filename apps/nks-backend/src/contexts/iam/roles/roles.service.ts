import { Injectable, Logger } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { RolePermissionService } from './role-permission.service';
import { TransactionService } from '../../../core/database/transaction.service';
import { RolesValidator } from './validators';
import { RoleMapper } from './mapper/role.mapper';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto';
import type { RoleResponseDto, RoleEntityPermissions } from './dto/role-response.dto';

/**
 * RolesService
 *
 * Manages role lifecycle (create, update, delete, assign to users).
 *
 * Authorization Contract:
 *   - createRole(): Requires ROLE.CREATE entity permission. Validates target storeGuuid matches activeStoreId.
 *   - updateRoleByGuuid(): Requires ROLE.EDIT entity permission. Validates role.storeFk matches activeStoreId.
 *   - deleteRole(): Requires ROLE.DELETE entity permission. Validates role.storeFk matches activeStoreId.
 *   - assignRoleToUser() / removeRoleFromUser() / removeAllUserStoreRoles(): Internal only.
 *     If ever exposed via a controller endpoint, the controller MUST pass activeStoreId
 *     and the method MUST be updated to call RolesValidator.assertRoleStoreAccess().
 *
 * Cross-Tenant Defense (Pattern 6):
 *   Every public mutation method receives activeStoreId from the controller and validates
 *   that the resource being modified belongs to that store. This prevents a user with
 *   ROLE.* permission in Store A from modifying roles in Store B by passing a known guuid.
 *   Permission decorators alone are NOT sufficient — they only check the action, not the
 *   resource scope.
 *
 * Business Rule Validation:
 *   - Store membership is enforced: roles are scoped to a single store (RolesValidator.assertStoreMatch)
 *   - System roles (isSystem=true) cannot be modified or deleted
 *   - Role codes cannot use reserved/system role codes
 *   - Permission ceiling check via RolePermissionService.updateRolePermissions()
 *   - Prevents privilege escalation: callers cannot grant permissions they don't have
 *
 * Audit Trail:
 *   - All operations tracked via AuditCommandService
 *   - userId/assignedBy/removedBy/deletedBy parameters identify operation performer
 *   - RolePermissionService handles permission-specific audit logging
 *
 * Transactionality:
 *   - updateRoleByGuuid() uses atomic transaction for metadata + permission changes
 *   - deleteRole() soft-deletes in transaction, with async changelog fan-out
 *   - assignRoleToUser() wraps DB operations in transaction for consistency
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolePermissionsRepository: PermissionsRepository,
    private readonly rolePermission: RolePermissionService,
    private readonly txService: TransactionService,
    private readonly auditCommand: AuditCommandService,
  ) {}

  async createRole(userId: number, dto: CreateRoleDto, activeStoreId: number | null): Promise<RoleResponseDto> {
    const storeFk = await this.rolesRepository.findStoreIdByGuuid(dto.storeGuuid);
    RolesValidator.assertStoreFound(storeFk);
    RolesValidator.assertStoreMatch(activeStoreId, storeFk);

    const isReserved = await this.rolesRepository.isSystemRoleCode(dto.code);
    RolesValidator.assertCodeNotReserved(isReserved);

    const role = await this.rolesRepository.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? null,
      isSystem: false,
      storeFk,
    }, userId);

    this.auditCommand.logRoleCreated(userId, role.id, role.code, storeFk);
    this.logger.log(`Role created: id=${role.id} code=${role.code} by user=${userId}`);
    return RoleMapper.buildRoleDto(role);
  }

  async updateRoleByGuuid(
    userId: number,
    guuid: string,
    dto: UpdateRoleDto,
    activeStoreId: number | null,
  ): Promise<RoleResponseDto> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleNotSystem(role.isSystem);
    RolesValidator.assertRoleStoreAccess(role.storeFk, activeStoreId);

    const entityEntries = dto.entityPermissions ? Object.entries(dto.entityPermissions) : [];

    let callerPerms: RoleEntityPermissions = {};
    if (entityEntries.length > 0) {
      RolesValidator.assertActiveStoreId(activeStoreId);
      callerPerms = await this.rolePermissionsRepository.getUserEntityPermissions(userId, activeStoreId);
    }

    const permEntries = entityEntries.map(([entityCode, requested]) => ({
      entityCode,
      canView:   requested.canView   ?? false,
      canCreate: requested.canCreate ?? false,
      canEdit:   requested.canEdit   ?? false,
      canDelete: requested.canDelete ?? false,
      deny:      requested.deny      ?? false,
    }));

    const metaData = {
      ...(dto.name        ? { roleName: dto.name }               : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder   !== undefined ? { sortOrder: dto.sortOrder }    : {}),
    };
    const hasMetaChanges = Object.keys(metaData).length > 0;
    const hasPermChanges = permEntries.length > 0;

    if (!hasMetaChanges && !hasPermChanges) {
      return RoleMapper.buildRoleDto(role);
    }

    // Atomic write: metadata + permissions in one transaction
    const updated = await this.txService.run(async (tx) => {
      const r = hasMetaChanges
        ? await this.rolesRepository.update(role.id, metaData, userId, tx)
        : role;
      if (hasPermChanges) {
        await this.rolePermission.updateRolePermissions(
          role.id, userId, entityEntries as [string, Record<string, boolean>][], permEntries, callerPerms, tx,
        );
      }
      return r;
    }, { name: 'UpdateRoleWithPermissions' });

    RolesValidator.assertFound(updated);

    // Post-commit effects (cache, audit, changelog) run after tx
    if (hasPermChanges) {
      this.rolePermission.postCommitEffects(role.id, userId, permEntries);
    }
    if (hasMetaChanges) {
      const metaChanges: Record<string, unknown> = {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      };
      this.auditCommand.logRoleUpdated(userId, role.id, updated.code, metaChanges);
    }

    this.logger.log(`Role updated: id=${role.id} code=${updated.code} by user=${userId}`);
    return RoleMapper.buildRoleDto(updated);
  }

  async assignRoleToUser(
    assignedBy: number,
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    isPrimary: boolean,
  ): Promise<void> {
    const row = await this.txService.run(async (tx) => {
      if (isPrimary) {
        await this.rolesRepository.unsetPrimaryRole(userFk, storeFk, tx);
      }
      return this.rolesRepository.assignRole(userFk, roleFk, storeFk, assignedBy, isPrimary, tx);
    }, { name: 'AssignRoleToUser' });

    if (row) {
      this.auditCommand.logRoleAssigned(assignedBy, userFk, roleFk, storeFk);
      this.rolePermission.recordRoleAssigned(userFk, roleFk);
    }
  }

  async removeRoleFromUser(userFk: number, roleFk: number, storeFk: number | null, removedBy?: number): Promise<void> {
    await this.rolesRepository.removeRole(userFk, roleFk, storeFk);
    this.auditCommand.logRoleRemoved(removedBy ?? userFk, userFk, roleFk, storeFk);
    this.rolePermission.recordRoleRemoved(userFk, roleFk);
  }

  async removeAllUserStoreRoles(userFk: number, storeFk: number, removedBy?: number): Promise<void> {
    const roleIds = await this.rolesRepository.removeAllStoreRoles(userFk, storeFk);
    if (roleIds.length > 0) {
      this.auditCommand.logRolesBulkRemoved(removedBy ?? userFk, userFk, storeFk, roleIds);
      this.rolePermission.recordRolesBulkRemoved(userFk, roleIds);
    }
  }

  async deleteRole(deletedBy: number, guuid: string, activeStoreId: number | null): Promise<void> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleNotSystem(role.isSystem);
    RolesValidator.assertRoleStoreAccess(role.storeFk, activeStoreId);

    // Wrap soft-delete and audit in transaction — ensures consistency if logic grows
    // Changelog fan-out is async and outside transaction (non-blocking, fire-and-forget)
    await this.txService.run(async (tx) => {
      await this.rolesRepository.softDelete(role.id, deletedBy, tx);
      this.auditCommand.logRoleDeleted(deletedBy, role.id, role.code);
      this.logger.log(`Role soft-deleted: id=${role.id} code=${role.code} by user=${deletedBy}`);
    });

    // Non-blocking changelog fan-out; failures are logged but do not roll back the delete
    this.rolePermission.recordRoleSoftDeleted(role.id).catch((e: unknown) => {
      this.logger.error(
        `Changelog fan-out failed after role delete: id=${role.id}: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  }
}
