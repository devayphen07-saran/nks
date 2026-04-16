import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RolesRepository } from './repositories/roles.repository';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import { RoleMapper } from './mapper/role.mapper';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import type { EntityPermission } from './dto/role-response.dto';
import { NotFoundException, ForbiddenException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';
import { AuditService } from '../audit/audit.service';
import { AuthUsersRepository } from '../auth/repositories/auth-users.repository';
import { PermissionsChangelogRepository } from '../auth/repositories/permissions-changelog.repository';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
    private readonly auditService: AuditService,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly changelogRepository: PermissionsChangelogRepository,
  ) {}

  // ─── Roles ────────────────────────────────────────────────────────────────

  /**
   * Get role details with all permissions (entity + route).
   * Includes record-level security check to verify user owns the store.
   *
   * @param guuid - Role GUUID
   * @param userId - User ID for store ownership verification
   * @returns Complete role detail with entity and route permissions
   * @throws ForbiddenException if user does not own the store
   */
  async getRoleWithPermissions(
    guuid: string,
    userId: number,
  ): Promise<
    Awaited<ReturnType<typeof this.rolesRepository.findByGuuid>> & {
      entityPermissions: Record<string, EntityPermission>;
      routePermissions: Array<{
        routeId: number;
        routePath: string;
        routeName: string;
        routeScope: string | null;
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canExport: boolean;
      }>;
    }
  > {
    // Get raw entity (not mapped) for internal security checks requiring storeFk
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });

    // Record-Level Security: Verify user owns the store this role belongs to
    if (role.storeFk) {
      const isOwner = await this.rolesRepository.isStoreOwner(
        userId,
        role.storeFk,
      );
      if (!isOwner) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'You do not have access to this role.',
        });
      }
    }

    // Fetch entity permissions
    const entityPerms = await this.roleEntityPermissionRepository.findByRoleId(
      role.id,
    );

    const entityPermissions = RoleMapper.toEntityPermissionMap(entityPerms);

    const routePermissions =
      await this.rolesRepository.findRoutePermissionsByRoleId(role.id);

    return {
      ...role,
      entityPermissions,
      routePermissions,
    };
  }

  /**
   * Create a new custom role for a specific store.
   * Only store owners can create roles in their stores.
   */
  async createRole(userId: number, dto: CreateRoleDto) {
    // Guard: Prevent creation of roles with reserved system role codes
    const RESERVED_CODES = ['SUPER_ADMIN', 'USER', 'STORE_OWNER', 'STAFF'];
    if (RESERVED_CODES.includes(dto.code.toUpperCase())) {
      throw new BadRequestException({
        errorCode: ErrorCode.BAD_REQUEST,
        message: `Role code '${dto.code}' is reserved for system roles and cannot be used for custom roles.`,
      });
    }

    // Verify user owns the store
    const isOwner = await this.rolesRepository.isStoreOwner(
      userId,
      dto.storeId,
    );
    if (!isOwner) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message:
          'You do not own this store. Only store owners can create roles.',
      });
    }

    const created = await this.rolesRepository.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description,
      sortOrder: dto.sortOrder,
      storeFk: dto.storeId,
      createdBy: userId,
    });
    this.logger.log(
      `Created role: ${dto.code} for store ${dto.storeId} by user ${userId}`,
    );
    this.auditService
      .logRoleCreated(userId, created.id, created.code, dto.storeId)
      .catch(() => {});
    return RoleMapper.toResponseDto(created);
  }

  /**
   * Update role by GUUID with store ownership verification.
   * Also applies entity permission changes atomically in the same call.
   */
  async updateRoleByGuuid(guuid: string, dto: UpdateRoleDto, userId: number) {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });

    if (role.storeFk) {
      const isOwner = await this.rolesRepository.isStoreOwner(
        userId,
        role.storeFk,
      );
      if (!isOwner)
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'You do not have access to this role.',
        });
    }

    if (role.isSystem)
      throw new ForbiddenException({
        errorCode: ErrorCode.ROLE_IS_SYSTEM,
        message: 'System roles cannot be modified',
      });

    const updated = await this.rolesRepository.update(role.id, {
      roleName: dto.name,
      description: dto.description,
      sortOrder: dto.sortOrder,
      modifiedBy: userId,
    });
    if (!updated)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });

    if (dto.entityPermissions && Object.keys(dto.entityPermissions).length > 0)
      await this.updateEntityPermissions(
        role.id,
        dto.entityPermissions,
        userId,
      );

    this.logger.log(`Updated role ${role.id} by user ${userId}`);
    this.auditService
      .logRoleUpdated(userId, role.id, role.code, {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
      })
      .catch(() => {});
    return RoleMapper.toResponseDto(updated);
  }

  /**
   * Update entity permissions for a role.
   * Replaces existing permissions with new ones for the given entity codes.
   *
   * @param roleId - Role ID
   * @param entityPermissions - Map of entity code to permission flags
   * @throws NotFoundException if any entity code does not exist
   */
  async updateEntityPermissions(
    roleId: number,
    entityPermissions: Record<string, Partial<EntityPermission>>,
    actorId?: number,
  ): Promise<void> {
    for (const [entityCode, perms] of Object.entries(entityPermissions)) {
      // Delete existing permission for this entity
      await this.roleEntityPermissionRepository.deleteByRoleAndEntity(
        roleId,
        entityCode,
      );

      const newPerms = {
        canView: perms.canView ?? false,
        canCreate: perms.canCreate ?? false,
        canEdit: perms.canEdit ?? false,
        canDelete: perms.canDelete ?? false,
      };

      // Create new permission (repository returns null if entity type not found)
      const created = await this.roleEntityPermissionRepository.create(
        roleId,
        entityCode,
        newPerms,
      );

      if (!created) {
        throw new NotFoundException({
          errorCode: ErrorCode.ENTITY_NOT_FOUND,
          message: `Entity type '${entityCode}' not found`,
        });
      }

      if (actorId) {
        this.auditService
          .logEntityPermissionChanged(actorId, roleId, entityCode, newPerms)
          .catch(() => {});
      }

      // Fan-out: bump permissionsVersion + write changelog for every user who holds
      // this role so their next /permissions-delta returns the precise diff.
      // Fire-and-forget — changelog failure must never block the role update itself.
      this.fanOutPermissionChange(
        roleId,
        entityCode,
        'MODIFIED',
        newPerms,
      ).catch((err: unknown) => {
        this.logger.error(
          `Permission changelog fan-out failed for role=${roleId} entity=${entityCode}`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    }
    this.logger.debug(`Updated entity permissions for role ${roleId}`);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Increment permissionsVersion and write a changelog entry for every active
   * user who holds `roleId`. Each user is processed independently — a failure
   * for one user is logged and skipped rather than aborting the full fan-out.
   *
   * @param roleId     - Role whose entity permission just changed
   * @param entityCode - Affected entity (e.g. 'PRODUCT')
   * @param operation  - 'ADDED' | 'MODIFIED' | 'REMOVED'
   * @param newPerms   - New permission flags (null for REMOVED)
   */
  private async fanOutPermissionChange(
    roleId: number,
    entityCode: string,
    operation: 'ADDED' | 'MODIFIED' | 'REMOVED',
    newPerms: Record<string, boolean> | null,
  ): Promise<void> {
    const userIds = await this.rolesRepository.findUsersByRoleId(roleId);
    if (userIds.length === 0) return;

    let successCount = 0;

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const newVersion =
            await this.authUsersRepository.incrementPermissionsVersion(userId);
          const match = /^v(\d+)$/.exec(newVersion);
          const versionNumber = match ? parseInt(match[1], 10) : 0;

          await this.changelogRepository.record([
            {
              userFk: userId,
              versionNumber,
              entityCode,
              operation,
              data: newPerms,
            },
          ]);

          successCount++;
        } catch (err) {
          this.logger.error(
            `fanOutPermissionChange: failed for user=${userId} role=${roleId} entity=${entityCode}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }),
    );

    this.logger.log(
      `fanOutPermissionChange: role=${roleId} entity=${entityCode} op=${operation} users=${successCount}/${userIds.length}`,
    );
  }

  // ─── Authorization helpers ────────────────────────────────────────────────

  /** Returns true if userId holds the STORE_OWNER role for storeId. */
  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    return this.rolesRepository.isStoreOwner(userId, storeId);
  }

  /** Returns all active role assignments for a user. */
  async findUserRoles(userId: number) {
    return this.rolesRepository.findUserRoles(userId);
  }

  /** Returns active roles for a user scoped to a specific store. */
  async getActiveRolesForStore(userId: number, storeId: number) {
    return this.rolesRepository.getActiveRolesForStore(userId, storeId);
  }
}
