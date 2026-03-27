import { Injectable } from '@nestjs/common';
import * as schema from '../../core/database/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class RolesRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  // ─── Internal Auth Reads (consumed by AuthService / RBACGuard) ────────────

  /** Get all roles assigned to a user (RBAC check). */
  async findUserRoles(userId: number) {
    return this.db
      .select({ roleId: schema.roles.id, roleCode: schema.roles.code })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.roles.isActive, true),
        ),
      );
  }

  /** Get all roles assigned to a user, including their store scope and store name. */
  async findUserRolesWithCompany(userId: number) {
    return this.db
      .select({
        roleId: schema.roles.id,
        roleCode: schema.roles.code,
        storeFk: schema.userRoleMapping.storeFk,
        storeName: schema.store.storeName,
      })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .leftJoin(
        schema.store,
        eq(schema.userRoleMapping.storeFk, schema.store.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.roles.isActive, true),
        ),
      );
  }

  /** Get all directly granted permissions for a user within a store. */
  async findUserDirectPermissions(userId: number, storeId: number) {
    return this.db
      .select({ code: schema.permissions.code })
      .from(schema.userPermissionMapping)
      .innerJoin(
        schema.permissions,
        eq(schema.userPermissionMapping.permissionFk, schema.permissions.id),
      )
      .where(
        and(
          eq(schema.userPermissionMapping.userFk, userId),
          eq(schema.userPermissionMapping.storeFk, storeId),
        ),
      );
  }

  /** Assign multiple permissions directly to a user for a store (replaces existing). */
  async setUserDirectPermissions(
    userId: number,
    storeId: number,
    permissionIds: number[],
    assignedBy: number,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    // Remove existing direct permissions for this user+store
    await client
      .delete(schema.userPermissionMapping)
      .where(
        and(
          eq(schema.userPermissionMapping.userFk, userId),
          eq(schema.userPermissionMapping.storeFk, storeId),
        ),
      );
    if (permissionIds.length === 0) return;
    // Insert new ones
    await client.insert(schema.userPermissionMapping).values(
      permissionIds.map((permissionFk) => ({
        userFk: userId,
        permissionFk,
        storeFk: storeId,
        assignedBy,
      })),
    );
  }

  /** Get all permissions for a set of role IDs (RBAC check). */
  async findPermissionsByRoleIds(roleIds: number[]) {
    if (roleIds.length === 0) return [];
    return this.db
      .select({ code: schema.permissions.code })
      .from(schema.rolePermissionMapping)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissionMapping.permissionFk, schema.permissions.id),
      )
      .where(and(inArray(schema.rolePermissionMapping.roleFk, roleIds)));
  }

  /** Find a role by exact code string (used during store registration). */
  async findByCode(code: string) {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.code, code), eq(schema.roles.isActive, true)))
      .limit(1);
    return role ?? null;
  }

  // ─── Role CRUD (consumed by RolesService / admin endpoints) ──────────────

  /** List all active roles. */
  async findAll() {
    return this.db
      .select()
      .from(schema.roles)
      .where(eq(schema.roles.isActive, true))
      .orderBy(schema.roles.sortOrder);
  }

  /** Find a role by numeric PK. */
  async findById(id: number) {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.isActive, true)))
      .limit(1);
    return role ?? null;
  }

  /** Create a new role. */
  async create(data: typeof schema.roles.$inferInsert, tx?: Tx) {
    const client = tx ?? this.db;
    const [created] = await client
      .insert(schema.roles)
      .values(data)
      .returning();
    return created;
  }

  /** Update mutable role fields (never updates code or isSystem). */
  async update(
    id: number,
    data: Partial<typeof schema.roles.$inferInsert>,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [updated] = await client
      .update(schema.roles)
      .set(data)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.isActive, true)))
      .returning();
    return updated ?? null;
  }

  /** Soft-delete a role. */
  async softDelete(id: number, deletedBy: number, tx?: Tx) {
    const client = tx ?? this.db;
    await client
      .update(schema.roles)
      .set({ isActive: false, deletedAt: new Date(), deletedBy })
      .where(eq(schema.roles.id, id));
  }

  // ─── Permission CRUD ──────────────────────────────────────────────────────

  /** List all active permissions, optionally filtered by resource (e.g. 'users', 'store'). */
  async findAllPermissions(resource?: string) {
    return this.db
      .select()
      .from(schema.permissions)
      .where(resource ? eq(schema.permissions.resource, resource) : undefined)
      .orderBy(schema.permissions.resource);
  }

  /** Find a permission by PK. */
  async findPermissionById(id: number) {
    const [perm] = await this.db
      .select()
      .from(schema.permissions)
      .where(eq(schema.permissions.id, id))
      .limit(1);
    return perm ?? null;
  }

  /** Create a new permission. */
  async createPermission(
    data: typeof schema.permissions.$inferInsert,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [created] = await client
      .insert(schema.permissions)
      .values(data)
      .returning();
    return created;
  }

  // ─── Role ↔ Permission Mapping ────────────────────────────────────────────

  /** Get all permissions attached to a role. */
  async findRolePermissions(roleId: number) {
    return this.db
      .select({ permission: schema.permissions })
      .from(schema.rolePermissionMapping)
      .innerJoin(
        schema.permissions,
        eq(schema.rolePermissionMapping.permissionFk, schema.permissions.id),
      )
      .where(and(eq(schema.rolePermissionMapping.roleFk, roleId)));
  }

  /** Assign a permission to a role. */
  async assignPermissionToRole(
    roleId: number,
    permissionId: number,
    assignedBy: number,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    await client.insert(schema.rolePermissionMapping).values({
      roleFk: roleId,
      permissionFk: permissionId,
      assignedBy,
    });
  }

  /** Remove a permission from a role. */
  async revokePermissionFromRole(
    roleId: number,
    permissionId: number,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    await client
      .delete(schema.rolePermissionMapping)
      .where(
        and(
          eq(schema.rolePermissionMapping.roleFk, roleId),
          eq(schema.rolePermissionMapping.permissionFk, permissionId),
        ),
      );
  }

  // ─── User ↔ Role Mapping ──────────────────────────────────────────────────

  /** Assign a role to a user, optionally scoped to a store. */
  async assignRoleToUser(
    userId: number,
    roleId: number,
    assignedBy: number,
    storeFk?: number | null,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    await client.insert(schema.userRoleMapping).values({
      userFk: userId,
      roleFk: roleId,
      storeFk: storeFk ?? null,
      assignedBy,
    });
  }

  /** Revoke a role from a user. */
  async revokeRoleFromUser(userId: number, roleId: number, tx?: Tx) {
    const client = tx ?? this.db;
    await client
      .delete(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.roleFk, roleId),
        ),
      );
  }

  // ─── Permission Checking ──────────────────────────────────────────────────

  /**
   * Check if a user has a specific permission (by resource and action)
   * Checks both role-based and direct user permissions
   */
  async checkUserPermission(
    userId: number,
    resource: string,
    action: string,
  ): Promise<boolean> {
    // First check if user is SUPER_ADMIN (has all permissions)
    const isSuperAdminUser = await this.isSuperAdmin(userId);
    if (isSuperAdminUser) return true;

    // Get all permissions for this user
    const userPermissions = await this.getUserPermissions(userId);
    const permissionCode = `${resource}.${action}`;

    // Check if user has the permission
    return userPermissions.some(
      (perm) => perm.code === permissionCode || perm.code === '*.*',
    );
  }

  /**
   * Get all permissions for a user (from all their roles + direct permissions)
   */
  async getUserPermissions(userId: number) {
    // Get user's roles
    const userRoles = await this.findUserRoles(userId);
    const roleIds = userRoles.map((r) => r.roleId);

    // Get permissions from roles
    const rolePermissions =
      roleIds.length > 0
        ? await this.findPermissionsByRoleIds(roleIds)
        : [];

    return rolePermissions;
  }

  /**
   * Check if user has SUPER_ADMIN role
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const userRoles = await this.findUserRoles(userId);
    return userRoles.some((role) => role.roleCode === 'SUPER_ADMIN');
  }
}
