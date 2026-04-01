import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { eq, and, inArray } from 'drizzle-orm';

export interface EntityPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  allow: boolean;
}

export interface RoleEntityPermissions {
  [entityCode: string]: EntityPermission;
}

@Injectable()
export class RoleEntityPermissionRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Get all entity permissions for a role
   */
  async getPermissionsByRole(roleId: number): Promise<RoleEntityPermissions> {
    const mappings = await this.db
      .select()
      .from(schema.roleEntityPermission)
      .where(
        and(
          eq(schema.roleEntityPermission.roleFk, roleId),
          eq(schema.roleEntityPermission.isActive, true),
        ),
      );

    const result: RoleEntityPermissions = {};
    mappings.forEach((mapping) => {
      result[mapping.entityCode] = {
        canView: mapping.canView,
        canCreate: mapping.canCreate,
        canEdit: mapping.canEdit,
        canDelete: mapping.canDelete,
        allow: mapping.allow,
      };
    });

    return result;
  }

  /**
   * Get permission for specific role and entity
   */
  async getPermission(
    roleId: number,
    entityCode: string,
  ): Promise<EntityPermission | null> {
    const mapping = await this.db
      .select()
      .from(schema.roleEntityPermission)
      .where(
        and(
          eq(schema.roleEntityPermission.roleFk, roleId),
          eq(schema.roleEntityPermission.entityCode, entityCode),
          eq(schema.roleEntityPermission.isActive, true),
        ),
      )
      .limit(1);

    if (!mapping.length) return null;

    const m = mapping[0];
    return {
      canView: m.canView,
      canCreate: m.canCreate,
      canEdit: m.canEdit,
      canDelete: m.canDelete,
      allow: m.allow,
    };
  }

  /**
   * Check if role has specific permission on entity
   */
  async checkPermission(
    roleId: number,
    entityCode: string,
    action: 'view' | 'create' | 'edit' | 'delete',
  ): Promise<boolean> {
    const permission = await this.getPermission(roleId, entityCode);
    if (!permission) return false;

    switch (action) {
      case 'view':
        return permission.canView;
      case 'create':
        return permission.canCreate;
      case 'edit':
        return permission.canEdit;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  }

  /**
   * Create or update entity permission for a role
   */
  async upsertPermission(
    roleId: number,
    entityCode: string,
    permission: Partial<EntityPermission>,
  ) {
    const existing = await this.db
      .select()
      .from(schema.roleEntityPermission)
      .where(
        and(
          eq(schema.roleEntityPermission.roleFk, roleId),
          eq(schema.roleEntityPermission.entityCode, entityCode),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      return this.db
        .update(schema.roleEntityPermission)
        .set({
          canView: permission.canView ?? existing[0].canView,
          canCreate: permission.canCreate ?? existing[0].canCreate,
          canEdit: permission.canEdit ?? existing[0].canEdit,
          canDelete: permission.canDelete ?? existing[0].canDelete,
          allow: permission.allow ?? existing[0].allow,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.roleEntityPermission.roleFk, roleId),
            eq(schema.roleEntityPermission.entityCode, entityCode),
          ),
        );
    } else {
      // Create new
      return this.db.insert(schema.roleEntityPermission).values({
        roleFk: roleId,
        entityCode,
        canView: permission.canView ?? false,
        canCreate: permission.canCreate ?? false,
        canEdit: permission.canEdit ?? false,
        canDelete: permission.canDelete ?? false,
        allow: permission.allow ?? false,
        isActive: true,
        isSystem: false,
      });
    }
  }

  /**
   * Get combined permissions for user across all their roles in a store
   */
  async getUserEntityPermissions(
    userId: number,
    storeId: number,
  ): Promise<RoleEntityPermissions> {
    const userRoles = await this.db
      .select({ roleId: schema.userRoleMapping.roleFk })
      .from(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, storeId),
          eq(schema.userRoleMapping.isActive, true),
        ),
      );

    if (userRoles.length === 0) {
      return {};
    }

    const roleIds = userRoles.map((r) => r.roleId);

    // Get all permissions for all user's roles
    const permissions = await this.db
      .select()
      .from(schema.roleEntityPermission)
      .where(
        and(
          inArray(schema.roleEntityPermission.roleFk, roleIds),
          eq(schema.roleEntityPermission.isActive, true),
        ),
      );

    // Merge permissions (union - if any role has permission, user has it)
    const result: RoleEntityPermissions = {};
    permissions.forEach((perm) => {
      if (!result[perm.entityCode]) {
        result[perm.entityCode] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          allow: false,
        };
      }
      // Union all permissions from all roles
      result[perm.entityCode].canView =
        result[perm.entityCode].canView || perm.canView;
      result[perm.entityCode].canCreate =
        result[perm.entityCode].canCreate || perm.canCreate;
      result[perm.entityCode].canEdit =
        result[perm.entityCode].canEdit || perm.canEdit;
      result[perm.entityCode].canDelete =
        result[perm.entityCode].canDelete || perm.canDelete;
      result[perm.entityCode].allow =
        result[perm.entityCode].allow || perm.allow;
    });

    return result;
  }

  /**
   * Delete permission (soft delete)
   */
  async deletePermission(roleId: number, entityCode: string) {
    return this.db
      .update(schema.roleEntityPermission)
      .set({ isActive: false, deletedAt: new Date() })
      .where(
        and(
          eq(schema.roleEntityPermission.roleFk, roleId),
          eq(schema.roleEntityPermission.entityCode, entityCode),
        ),
      );
  }
}
