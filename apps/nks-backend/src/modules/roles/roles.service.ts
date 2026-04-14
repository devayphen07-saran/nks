import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { RoleEntityPermissionRepository } from './role-entity-permission.repository';
import { RoleMapper } from './mapper/role.mapper';
import { CreateRoleDto, UpdateRoleDto } from './dto';
import type { EntityPermission } from './dto/role-response.dto';
import { NotFoundException, ForbiddenException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly rolesRepository: RolesRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
  ) {}

  // ─── Roles ────────────────────────────────────────────────────────────────

  /**
   * List all roles with optional filtering and pagination.
   */
  async listRoles(
    opts: { search?: string; page?: number; pageSize?: number } = {},
  ) {
    const { rows, total } = await this.rolesRepository.findAll(opts);
    return {
      rows: rows.map(RoleMapper.toResponseDto),
      total,
    };
  }

  /**
   * Get a role by numeric ID.
   */
  async getRole(id: number) {
    const role = await this.rolesRepository.findById(id);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    return RoleMapper.toResponseDto(role);
  }

  /**
   * Get a role by GUUID (public-safe identifier).
   */
  async getRoleByGuuid(guuid: string) {
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    return RoleMapper.toResponseDto(role);
  }

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
    return RoleMapper.toResponseDto(created);
  }

  /**
   * Update role by GUUID with store ownership verification.
   */
  async updateRoleByGuuid(guuid: string, dto: UpdateRoleDto, userId: number) {
    // Get raw entity for internal security checks requiring storeFk
    const role = await this.rolesRepository.findByGuuid(guuid);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });

    // Verify user owns the store
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

    return this.updateRole(role.id, dto, userId);
  }

  /**
   * Update a role by ID.
   */
  async updateRole(id: number, dto: UpdateRoleDto, modifiedBy: number) {
    const role = await this.rolesRepository.findById(id);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    if (role.isSystem) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ROLE_IS_SYSTEM,
        message: 'System roles cannot be modified',
      });
    }
    const updated = await this.rolesRepository.update(id, {
      roleName: dto.name,
      description: dto.description,
      sortOrder: dto.sortOrder,
      modifiedBy,
    });
    if (!updated)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    this.logger.log(`Updated role ${id} by user ${modifiedBy}`);
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
  ): Promise<void> {
    for (const [entityCode, perms] of Object.entries(entityPermissions)) {
      // Delete existing permission for this entity
      await this.roleEntityPermissionRepository.deleteByRoleAndEntity(
        roleId,
        entityCode,
      );

      // Create new permission (repository returns null if entity type not found)
      const created = await this.roleEntityPermissionRepository.create(
        roleId,
        entityCode,
        {
          canView: perms.canView ?? false,
          canCreate: perms.canCreate ?? false,
          canEdit: perms.canEdit ?? false,
          canDelete: perms.canDelete ?? false,
        },
      );

      if (!created) {
        throw new NotFoundException({
          errorCode: ErrorCode.ENTITY_NOT_FOUND,
          message: `Entity type '${entityCode}' not found`,
        });
      }
    }
    this.logger.debug(`Updated entity permissions for role ${roleId}`);
  }

  /**
   * Delete a role by ID.
   */
  async deleteRole(id: number, deletedBy: number) {
    const role = await this.rolesRepository.findById(id);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    if (role.isSystem) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ROLE_CANNOT_DELETE_SYSTEM,
        message: 'System roles cannot be deleted',
      });
    }
    await this.rolesRepository.softDelete(id, deletedBy);
    this.logger.log(`Deleted role ${id} by user ${deletedBy}`);
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
