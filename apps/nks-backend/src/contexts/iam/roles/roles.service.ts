import { Injectable, Logger } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { PermissionsRepository } from './repositories/role-permissions.repository';
import { PermissionEvaluatorService } from './permission-evaluator.service';
import { TransactionService } from '../../../core/database/transaction.service';
import { RolesValidator } from './validators';
import { RoleMapper } from './mapper/role.mapper';
import { AuditService } from '../../compliance/audit/audit.service';
import { PermissionsChangelogService } from '../../../shared/permissions-changelog/permissions-changelog.service';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type { CreateRoleDto, UpdateRoleDto } from './dto';
import type {
  RoleResponseDto,
  RoleDetailResponse,
} from './dto/role-response.dto';
import type {
  UserRoleRow,
  UserRoleWithStoreRow,
} from './dto/role-response.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly rolePermissionsRepository: PermissionsRepository,
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly txService: TransactionService,
    private readonly auditService: AuditService,
    private readonly permissionsChangelog: PermissionsChangelogService,
  ) {}

  async createRole(
    userId: number,
    dto: CreateRoleDto,
    activeStoreId: number | null,
  ): Promise<RoleResponseDto> {
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

    this.auditService.logRoleCreated(userId, role.id, role.code, storeFk);
    this.logger.log(`Role created: ${role.code} by user ${userId}`);
    return RoleMapper.buildRoleDto(role);
  }

  async getRoleWithPermissions(
    guuid: string,
    activeStoreId: number | null,
  ): Promise<RoleDetailResponse> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleStoreAccess(role.storeFk, activeStoreId);

    const [flatPermissions, entityHierarchy, routePermissions, storeGuuid] = await Promise.all([
      this.rolePermissionsRepository.getEntityPermissionMapForRole(role.id),
      this.rolePermissionsRepository.getEntityTypeHierarchy(),
      this.rolesRepository.findRoutePermissionsByRoleId(role.id),
      role.storeFk ? this.rolesRepository.getStoreGuuidByFk(role.storeFk) : Promise.resolve(null),
    ]);

    const entityPermissions = RoleMapper.buildEntityPermissionTree(entityHierarchy, flatPermissions);
    return RoleMapper.buildRoleDetailDto(role, storeGuuid, entityPermissions, routePermissions);
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

    const entityEntries = dto.entityPermissions
      ? Object.entries(dto.entityPermissions)
      : [];

    // Permission-ceiling check ONLY runs when entity permissions are being
    // modified. Renaming a role, editing its description, or reordering does
    // not escalate privilege, so skipping the caller-perms lookup here is
    // intentional (and saves a DB round-trip on pure-metadata updates).
    //
    // IMPORTANT — adding a new field to UpdateRoleDto:
    //   • If the new field CAN escalate privilege (role scope, inherited
    //     permissions, parent role, "is_super_admin" flag, …): add its own
    //     ceiling-style check alongside or outside this branch.
    //   • If it's purely descriptive (sortOrder, tags, icons): leave this
    //     branch alone.
    // The check is not automatic — it guards entityPermissions specifically.
    if (entityEntries.length > 0) {
      RolesValidator.assertActiveStoreId(activeStoreId);
      const callerPerms =
        await this.rolePermissionsRepository.getUserEntityPermissions(
          userId,
          activeStoreId,
        );
      RolesValidator.assertPermissionCeiling(entityEntries, callerPerms);
    }

    const permEntries = entityEntries.map(([entityCode, requested]) => ({
      entityCode,
      canView:   Boolean(requested['canView']),
      canCreate: Boolean(requested['canCreate']),
      canEdit:   Boolean(requested['canEdit']),
      canDelete: Boolean(requested['canDelete']),
      deny:      Boolean(requested['deny']),
    }));

    // Atomic: role metadata update + permission upsert in one transaction.
    // If bulkUpsert fails, the role name/description change is rolled back too —
    // no partial state where metadata is updated but permissions are stale.
    const updated = await this.txService.run(
      async (tx) => {
        const r = await this.rolesRepository.update(
          role.id,
          {
            ...(dto.name        ? { roleName: dto.name }               : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.sortOrder   !== undefined ? { sortOrder: dto.sortOrder }    : {}),
          },
          tx,
        );
        if (permEntries.length > 0) {
          await this.rolePermissionsRepository.bulkUpsert(role.id, permEntries, tx);
        }
        return r;
      },
      { name: 'UpdateRoleWithPermissions' },
    );
    RolesValidator.assertFound(updated);
    this.permissionEvaluator.invalidateForRole(role.id);

    // Audit and fan-out each permission change individually.
    for (const { entityCode, ...perms } of permEntries) {
      this.auditService.logEntityPermissionChanged(userId, role.id, entityCode, perms);
      void this.permissionsChangelog.recordChange(role.id, entityCode, 'MODIFIED', perms);
    }

    const metaChanges: Record<string, unknown> = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };
    if (Object.keys(metaChanges).length > 0) {
      this.auditService.logRoleUpdated(userId, role.id, updated.code, metaChanges);
    }

    this.logger.log(`Role updated: ${updated.code} by user ${userId}`);
    return RoleMapper.buildRoleDto(updated);
  }

  /**
   * Assign a role to an existing user.
   * Bumps permissionsVersion and writes ADDED changelog entries after the DB insert.
   */
  async assignRoleToUser(
    assignedBy: number,
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    isPrimary: boolean,
  ): Promise<void> {
    const row = await this.rolesRepository.assignRole(userFk, roleFk, storeFk, assignedBy, isPrimary);
    if (row) {
      void this.permissionsChangelog.recordRoleAssigned(userFk, roleFk);
    }
  }

  /**
   * Remove a specific role assignment from a user.
   * Bumps permissionsVersion and writes REMOVED changelog entries after the soft-delete.
   */
  async removeRoleFromUser(
    userFk: number,
    roleFk: number,
    storeFk: number | null,
  ): Promise<void> {
    await this.rolesRepository.removeRole(userFk, roleFk, storeFk);
    void this.permissionsChangelog.recordRoleRemoved(userFk, roleFk);
  }

  /**
   * Remove all role assignments for a user in a specific store.
   * Bumps permissionsVersion for each removed role.
   */
  async removeAllUserStoreRoles(userFk: number, storeFk: number): Promise<void> {
    // Capture affected roleIds BEFORE soft-deleting so we can fan-out per role.
    const activeRoles = await this.rolesRepository.getActiveRolesForStore(userFk, storeFk);
    await this.rolesRepository.removeAllStoreRoles(userFk, storeFk);
    for (const { roleId } of activeRoles) {
      void this.permissionsChangelog.recordRoleRemoved(userFk, roleId);
    }
  }

  /**
   * Soft-delete a role and fan-out REMOVED changelog entries to all users who held it.
   * Permissions are fetched before deletion so the changelog captures what was lost.
   */
  async deleteRole(deletedBy: number, guuid: string): Promise<void> {
    const role = await this.rolesRepository.findByGuuid(guuid);
    RolesValidator.assertFound(role);
    RolesValidator.assertRoleNotSystem(role.isSystem);
    // Fan-out runs before softDelete so role permissions are still readable.
    await this.permissionsChangelog.recordRoleSoftDeleted(role.id);
    await this.rolesRepository.softDelete(role.id, deletedBy);
    this.permissionEvaluator.invalidateForRole(role.id);
    this.logger.log(`Role soft-deleted: ${role.code} by user ${deletedBy}`);
  }

  async listUserRoles(userId: number): Promise<UserRoleWithStoreRow[]> {
    return this.rolesRepository.findUserRoles(userId);
  }

  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    return this.rolesRepository.isStoreOwner(userId, storeId);
  }

  async getActiveRolesForStore(
    userId: number,
    storeId: number,
  ): Promise<Pick<UserRoleRow, 'roleId' | 'roleCode' | 'isSystem' | 'isPrimary'>[]> {
    return this.rolesRepository.getActiveRolesForStore(userId, storeId);
  }

  async listRoles(opts: {
    page: number;
    pageSize: number;
    storeId: number | null;
    isSuperAdmin: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    isActive?: boolean;
  }): Promise<PaginatedResult<RoleResponseDto>> {
    const { rows, total } = await this.rolesRepository.findAll({
      search: opts.search,
      page: opts.page,
      pageSize: opts.pageSize,
      storeId: opts.storeId,
      isSuperAdmin: opts.isSuperAdmin,
      sortBy: opts.sortBy,
      sortOrder: opts.sortOrder,
      isActive: opts.isActive,
    });
    return paginated({ items: rows, page: opts.page, pageSize: opts.pageSize, total });
  }
}
