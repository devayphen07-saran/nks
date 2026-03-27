import { Injectable } from '@nestjs/common';
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
  constructor(private readonly repo: RolesRepository) {}

  // ─── Roles ────────────────────────────────────────────────────────────────

  async listRoles() {
    return this.repo.findAll();
  }

  async getRole(id: number) {
    const role = await this.repo.findById(id);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    return role;
  }

  async createRole(dto: CreateRoleDto, createdBy: number) {
    const existing = await this.repo.findByCode(dto.code);
    if (existing) {
      throw new ConflictException({
        errorCode: ErrorCode.ROLE_ALREADY_EXISTS,
        message: `Role code '${dto.code}' already exists`,
      });
    }
    return this.repo.create({
      roleName: dto.name,
      code: dto.code,
      description: dto.description,
      sortOrder: dto.sortOrder,
      isSystem: dto.isSystem,
      createdBy,
    });
  }

  async updateRole(id: number, dto: UpdateRoleDto, modifiedBy: number) {
    const role = await this.repo.findById(id);
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
    const updated = await this.repo.update(id, {
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
    return updated;
  }

  async deleteRole(id: number, deletedBy: number) {
    const role = await this.repo.findById(id);
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
    await this.repo.softDelete(id, deletedBy);
  }

  // ─── Permissions ──────────────────────────────────────────────────────────

  async listPermissions(resource?: string) {
    return this.repo.findAllPermissions(resource);
  }

  async createPermission(dto: CreatePermissionDto) {
    return this.repo.createPermission({
      name: dto.name,
      code: dto.code,
      resource: dto.resource,
      action: dto.action,
      description: dto.description,
    });
  }

  async getRolePermissions(roleId: number) {
    await this.getRole(roleId); // ensures role exists
    return this.repo.findRolePermissions(roleId);
  }

  async assignPermissionToRole(
    roleId: number,
    permissionId: number,
    assignedBy: number,
  ) {
    const [role, perm] = await Promise.all([
      this.repo.findById(roleId),
      this.repo.findPermissionById(permissionId),
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
    await this.repo.assignPermissionToRole(roleId, permissionId, assignedBy);
  }

  async revokePermissionFromRole(roleId: number, permissionId: number) {
    await this.getRole(roleId);
    await this.repo.revokePermissionFromRole(roleId, permissionId);
  }

  // ─── User ↔ Role Assignment ───────────────────────────────────────────────

  async assignRoleToUser(userId: number, roleId: number, assignedBy: number) {
    const role = await this.repo.findById(roleId);
    if (!role)
      throw new NotFoundException({
        errorCode: ErrorCode.ROLE_NOT_FOUND,
        message: 'Role not found',
      });
    await this.repo.assignRoleToUser(userId, roleId, assignedBy);
  }

  async revokeRoleFromUser(userId: number, roleId: number, assignedBy: number) {
    const role = await this.repo.findById(roleId);
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
    await this.repo.revokeRoleFromUser(userId, roleId);
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
    return this.repo.checkUserPermission(userId, resource, action);
  }

  /**
   * Get all permissions for a user (across all their roles)
   * @param userId - The user ID
   * @returns List of permissions
   */
  async getUserPermissions(userId: number) {
    return this.repo.getUserPermissions(userId);
  }

  /**
   * Check if user has SUPER_ADMIN role
   * @param userId - The user ID
   * @returns true if user is super admin
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    return this.repo.isSuperAdmin(userId);
  }
}
