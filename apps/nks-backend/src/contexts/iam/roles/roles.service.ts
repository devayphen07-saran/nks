import { Injectable, Logger } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { RolePermissionService } from './role-permission.service';
import { RolesValidator } from './validators';
import { RoleMapper } from './mapper/role.mapper';
import { AuditCommandService } from '../../compliance/audit/audit-command.service';
import type { CreateRoleDto, UpdateRoleDto } from './dto';
import type { RoleResponseDto, RoleEntityPermissions } from './dto/role-response.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolePermissionsRepository: PermissionsRepository,
    private readonly rolePermission: RolePermissionService,
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
    });

    this.auditCommand.logRoleCreated(userId, role.id, role.code, storeFk);
    this.logger.log(`Role created: ${role.code} by user ${userId}`);
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
      canView:   Boolean(requested['canView']),
      canCreate: Boolean(requested['canCreate']),
      canEdit:   Boolean(requested['canEdit']),
      canDelete: Boolean(requested['canDelete']),
      deny:      Boolean(requested['deny']),
    }));

    // Update role metadata
    const updated = await this.rolesRepository.update(
      role.id,
      {
        ...(dto.name        ? { roleName: dto.name }               : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.sortOrder   !== undefined ? { sortOrder: dto.sortOrder }    : {}),
      },
    );
    RolesValidator.assertFound(updated);

    // Update permissions (delegated to RolePermissionService)
    if (permEntries.length > 0) {
      await this.rolePermission.updateRolePermissions(
        role.id,
        userId,
        entityEntries as [string, Record<string, boolean>][],
        permEntries,
        callerPerms,
      );
    }

    // Audit log metadata changes
    const metaChanges: Record<string, unknown> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
    if (Object.keys(metaChanges).length > 0) {
      this.auditCommand.logRoleUpdated(userId, role.id, updated.code, metaChanges);
    }

    this.logger.log(`Role updated: ${updated.code} by user ${userId}`);
    return RoleMapper.buildRoleDto(updated);
  }

  async assignRoleToUser(
    assignedBy: number,
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    isPrimary: boolean,
  ): Promise<void> {
    const row = await this.rolesRepository.assignRole(userFk, roleFk, storeFk, assignedBy, isPrimary);
    if (row) {
      this.rolePermission.recordRoleAssigned(userFk, roleFk);
    }
  }

  async removeRoleFromUser(userFk: number, roleFk: number, storeFk: number | null): Promise<void> {
    await this.rolesRepository.removeRole(userFk, roleFk, storeFk);
    this.rolePermission.recordRoleRemoved(userFk, roleFk);
  }

  async removeAllUserStoreRoles(userFk: number, storeFk: number): Promise<void> {
    const activeRoles = await this.rolesRepository.getActiveRolesForStore(userFk, storeFk);
    await this.rolesRepository.removeAllStoreRoles(userFk, storeFk);
    const roleIds = activeRoles.map(({ roleId }) => roleId);
    this.rolePermission.recordRolesBulkRemoved(userFk, roleIds);
  }

  async deleteRole(deletedBy: number, guuid: string): Promise<void> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleNotSystem(role.isSystem);
    await this.rolePermission.recordRoleSoftDeleted(role.id);
    await this.rolesRepository.softDelete(role.id, deletedBy);
    this.logger.log(`Role soft-deleted: ${role.code} by user ${deletedBy}`);
  }
}
