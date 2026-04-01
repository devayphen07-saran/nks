import { Injectable, Logger } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { CreateRoleDto, UpdateRoleDto, CreatePermissionDto } from './dto';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(private readonly rolesRepository: RolesRepository) {}

  // ─── Roles ────────────────────────────────────────────────────────────────

  async listRoles(
    opts: { search?: string; page?: number; pageSize?: number } = {},
  ) {
    return this.rolesRepository.findAll(opts);
  }

  async getRole(id: number) {
    const role = await this.rolesRepository.findById(id);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    return role;
  }

  async createRole(dto: CreateRoleDto, createdBy: number) {
    const existing = await this.rolesRepository.findByCode(dto.code);
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.ROLE_ALREADY_EXISTS,
        message: `Role code '${dto.code}' already exists`,
      });
    }
    const created = await this.rolesRepository.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description,
      sortOrder: dto.sortOrder,
      isSystem: dto.isSystem,
      createdBy,
    });
    this.logger.log(`Created role: ${dto.code} by user ${createdBy}`);
    return created;
  }

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
    return updated;
  }

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

  // ─── Permissions ──────────────────────────────────────────────────────────

  async listPermissions(resource?: string) {
    return this.rolesRepository.findAllPermissions(resource);
  }

  async createPermission(dto: CreatePermissionDto) {
    return this.rolesRepository.createPermission({
      name: dto.name,
      code: dto.code,
      resource: dto.resource,
      action: dto.action,
      description: dto.description,
    });
  }

  async getRolePermissions(roleId: number) {
    await this.getRole(roleId); // ensures role exists
    return this.rolesRepository.findRolePermissions(roleId);
  }

  async assignPermissionToRole(
    roleId: number,
    permissionId: number,
    assignedBy: number,
  ) {
    const [role, perm] = await Promise.all([
      this.rolesRepository.findById(roleId),
      this.rolesRepository.findPermissionById(permissionId),
    ]);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    if (!perm)
      throw new NotFoundException({
        errorCode: ErrorCode.PERMISSION_NOT_FOUND,
        message: 'Permission not found',
      });
    await this.rolesRepository.assignPermissionToRole(
      roleId,
      permissionId,
      assignedBy,
    );
  }

  async revokePermissionFromRole(roleId: number, permissionId: number) {
    await this.getRole(roleId);
    await this.rolesRepository.revokePermissionFromRole(roleId, permissionId);
  }

  // ─── User ↔ Role Assignment ───────────────────────────────────────────────

  async assignRoleToUser(userId: number, roleId: number, assignedBy: number) {
    const role = await this.rolesRepository.findById(roleId);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    await this.rolesRepository.assignRoleToUser(userId, roleId, assignedBy);
  }

  /** Temporarily suspend a user's role (isActive=false). Keeps audit trail intact. */
  async suspendUserRole(userId: number, roleId: number) {
    return this.rolesRepository.setUserRoleMappingActive(userId, roleId, false);
  }

  /** Re-enable a previously suspended user role. */
  async restoreUserRole(userId: number, roleId: number) {
    return this.rolesRepository.setUserRoleMappingActive(userId, roleId, true);
  }

  async revokeRoleFromUser(userId: number, roleId: number, assignedBy: number) {
    const role = await this.rolesRepository.findById(roleId);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    // Guard: cannot revoke SUPER_ADMIN from yourself
    if (role.code === 'SUPER_ADMIN' && userId === assignedBy) {
      throw new ForbiddenException({
        errorCode: ErrorCode.ROLE_CANNOT_DELETE_SYSTEM,
        message: 'Cannot revoke SUPER_ADMIN from yourself',
      });
    }
    await this.rolesRepository.revokeRoleFromUser(userId, roleId);
  }

  // ─── Permission Checking ──────────────────────────────────────────────────

  /**
   * Check if a user has a specific permission
   * @param userId - The user ID
   * @param resource - Resource name (e.g., 'customers')
   * @param action - Action name (e.g., 'view', 'create', 'edit', 'delete')
   * @returns true if user has the permission, false otherwise
   */
  async checkUserPermission(
    userId: number,
    resource: string,
    action: string,
  ): Promise<boolean> {
    return this.rolesRepository.checkUserPermission(userId, resource, action);
  }

  /**
   * Get all permissions for a user (across all their roles)
   * @param userId - The user ID
   * @returns List of permissions
   */
  async getUserPermissions(userId: number) {
    return this.rolesRepository.getUserPermissions(userId);
  }

  /**
   * Check if user has SUPER_ADMIN role
   * @param userId - The user ID
   * @returns true if user is super admin
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    return this.rolesRepository.isSuperAdmin(userId);
  }
}
