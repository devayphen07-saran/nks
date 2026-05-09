import { eq, and, inArray } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { roles, permissions, rolePermissions, userStoreRoles } from '../schema';
import type {
  RoleRow,
  PermissionRow,
  InsertRole,
  InsertPermission,
  InsertRolePermission,
  InsertUserStoreRole,
} from '../schema';

export interface StoreRolesSnapshot {
  roles:           InsertRole[];
  permissions:     InsertPermission[];
  rolePermissions: InsertRolePermission[];
  userRoles:       InsertUserStoreRole[];
}

/**
 * Local mirror of the user's roles and permissions for a store.
 *
 * Populated by the replicator from `GET /stores/:id/config` after each sync.
 * Read by mutation enqueue paths to enforce permissions before pushing.
 */
export class RolesRepository {
  private get db() { return getDatabase(); }

  /** Replace all role/permission data for a store atomically. */
  async replaceForStore(storeId: number, snapshot: StoreRolesSnapshot): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(roles).where(eq(roles.storeId, storeId));
      await tx.delete(permissions).where(eq(permissions.storeId, storeId));
      await tx.delete(rolePermissions).where(eq(rolePermissions.storeId, storeId));
      await tx.delete(userStoreRoles).where(eq(userStoreRoles.storeId, storeId));

      if (snapshot.roles.length)           await tx.insert(roles).values(snapshot.roles);
      if (snapshot.permissions.length)     await tx.insert(permissions).values(snapshot.permissions);
      if (snapshot.rolePermissions.length) await tx.insert(rolePermissions).values(snapshot.rolePermissions);
      if (snapshot.userRoles.length)       await tx.insert(userStoreRoles).values(snapshot.userRoles);
    });
  }

  async getRolesForStore(storeId: number): Promise<RoleRow[]> {
    return this.db.select().from(roles).where(eq(roles.storeId, storeId));
  }

  async getPermissionsForStore(storeId: number): Promise<PermissionRow[]> {
    return this.db.select().from(permissions).where(eq(permissions.storeId, storeId));
  }

  async getUserRoleCodes(userId: string, storeId: number): Promise<string[]> {
    const rows = await this.db
      .select({ roleCode: userStoreRoles.roleCode })
      .from(userStoreRoles)
      .where(and(eq(userStoreRoles.userId, userId), eq(userStoreRoles.storeId, storeId)));
    return rows.map((r) => r.roleCode);
  }

  async getUserPermissionCodes(userId: string, storeId: number): Promise<string[]> {
    const userRoles = await this.getUserRoleCodes(userId, storeId);
    if (!userRoles.length) return [];

    const rows = await this.db
      .select({ permissionCode: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.storeId, storeId),
          inArray(rolePermissions.roleCode, userRoles),
        ),
      );

    const unique = new Set(rows.map((r) => r.permissionCode));
    return Array.from(unique);
  }

  async hasPermission(userId: string, storeId: number, permissionCode: string): Promise<boolean> {
    const codes = await this.getUserPermissionCodes(userId, storeId);
    return codes.includes(permissionCode);
  }

  /**
   * Hard-delete all RBAC rows for one store. Used when switching away from
   * a store so the next store starts with a clean permission set.
   */
  async deleteByStoreId(storeId: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(userStoreRoles).where(eq(userStoreRoles.storeId, storeId));
      await tx.delete(rolePermissions).where(eq(rolePermissions.storeId, storeId));
      await tx.delete(permissions).where(eq(permissions.storeId, storeId));
      await tx.delete(roles).where(eq(roles.storeId, storeId));
    });
  }

  async clear(): Promise<void> {
    await this.db.delete(userStoreRoles);
    await this.db.delete(rolePermissions);
    await this.db.delete(permissions);
    await this.db.delete(roles);
  }
}

export const rolesRepository = new RolesRepository();
