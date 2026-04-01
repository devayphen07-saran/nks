import { Injectable } from '@nestjs/common';
import * as schema from '../../core/database/schema';
import { eq, inArray, and, isNotNull, ilike, or, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class RolesRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  // ─── Internal Auth Reads (consumed by AuthService / RBACGuard) ────────────

  /** Get all active roles assigned to a user (RBAC check). */
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
          eq(schema.userRoleMapping.isActive, true),
          eq(schema.roles.isActive, true),
        ),
      );
  }

  /** Get all active roles assigned to a user, including their store scope and store name. */
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
          eq(schema.userRoleMapping.isActive, true),
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

  /** Get all allowed routes (with CRUD flags) for a set of role IDs. */
  async findRoutesByRoleIds(roleIds: number[]) {
    if (roleIds.length === 0) return [];
    return this.db
      .selectDistinctOn([schema.routes.routePath], {
        id: schema.routes.id,
        routeName: schema.routes.routeName,
        routePath: schema.routes.routePath,
        fullPath: schema.routes.fullPath,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        appCode: schema.routes.appCode,
        isPublic: schema.routes.isPublic,
        parentRouteFk: schema.routes.parentRouteFk,
        sortOrder: schema.routes.sortOrder,
        canView: schema.roleRouteMapping.canView,
        canCreate: schema.roleRouteMapping.canCreate,
        canEdit: schema.roleRouteMapping.canEdit,
        canDelete: schema.roleRouteMapping.canDelete,
        canExport: schema.roleRouteMapping.canExport,
      })
      .from(schema.roleRouteMapping)
      .innerJoin(
        schema.routes,
        eq(schema.roleRouteMapping.routeFk, schema.routes.id),
      )
      .where(
        and(
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      )
      .orderBy(schema.routes.routePath, schema.routes.sortOrder);
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

  /** List active roles with optional search (code, name, description) and pagination. */
  async findAll(
    opts: { search?: string; page?: number; pageSize?: number } = {},
  ) {
    const { search, page = 1, pageSize = 50 } = opts;
    const offset = (page - 1) * pageSize;

    const searchFilter = search?.trim()
      ? or(
          ilike(schema.roles.code, `%${search}%`),
          ilike(schema.roles.roleName, `%${search}%`),
          ilike(schema.roles.description, `%${search}%`),
        )
      : undefined;

    const where = and(eq(schema.roles.isActive, true), searchFilter);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.roles)
        .where(where)
        .orderBy(schema.roles.sortOrder)
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.roles)
        .where(where),
    ]);

    return { rows, total, page, pageSize };
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

  /** Soft-suspend or restore a user's role mapping without deleting the record. */
  async setUserRoleMappingActive(
    userId: number,
    roleId: number,
    isActive: boolean,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    await client
      .update(schema.userRoleMapping)
      .set({ isActive })
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.roleFk, roleId),
        ),
      );
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
      roleIds.length > 0 ? await this.findPermissionsByRoleIds(roleIds) : [];

    return rolePermissions;
  }

  /**
   * Check if user has SUPER_ADMIN role
   */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const userRoles = await this.findUserRoles(userId);
    return userRoles.some((role) => role.roleCode === 'SUPER_ADMIN');
  }

  /**
   * Single-query permission resolution scoped to the user's active store.
   *
   * Returns:
   *  - isSuperAdmin: true  → caller should bypass all permission checks
   *  - permissionCodes: string[] → permission codes granted by the user's
   *    roles in their currently active store (from the session token)
   *
   * Store scoping: Only roles where userRoleMapping.store_fk = userSession.active_store_fk
   * are considered, preventing cross-store permission bleed.
   */
  async getActiveStorePermissionCodes(
    userId: number,
    sessionToken: string,
  ): Promise<{ isSuperAdmin: boolean; permissionCodes: string[] }> {
    // Fast SUPER_ADMIN check (single row lookup, no joins needed)
    const [adminRow] = await this.db
      .select({ roleCode: schema.roles.code })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.roles.code, 'SUPER_ADMIN'),
          eq(schema.roles.isActive, true),
        ),
      )
      .limit(1);

    if (adminRow) return { isSuperAdmin: true, permissionCodes: [] };

    // Fetch activeStoreFk from session (needed for store scoping)
    const [sessionRow] = await this.db
      .select({ activeStoreFk: schema.userSession.activeStoreFk })
      .from(schema.userSession)
      .where(
        and(
          eq(schema.userSession.token, sessionToken),
          eq(schema.userSession.userId, userId),
        ),
      )
      .limit(1);

    if (!sessionRow?.activeStoreFk) {
      // User has no active store (personal account only)
      return { isSuperAdmin: false, permissionCodes: [] };
    }

    // Fetch permission codes from TWO sources:
    // 1. Role-based permissions: user_role_mapping → role_permission_mapping → permissions
    // 2. Direct permissions: user_permission_mapping → permissions
    // Both scoped to the active store
    const roleBasedPerms = await this.db
      .selectDistinct({ code: schema.permissions.code })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.roles.id, schema.userRoleMapping.roleFk),
      )
      .innerJoin(
        schema.rolePermissionMapping,
        eq(schema.rolePermissionMapping.roleFk, schema.userRoleMapping.roleFk),
      )
      .innerJoin(
        schema.permissions,
        eq(schema.permissions.id, schema.rolePermissionMapping.permissionFk),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, sessionRow.activeStoreFk),
          eq(schema.userRoleMapping.isActive, true),
          eq(schema.roles.isActive, true),
        ),
      );

    // Fetch direct user permissions for the same store
    const directPerms = await this.db
      .selectDistinct({ code: schema.permissions.code })
      .from(schema.userPermissionMapping)
      .innerJoin(
        schema.permissions,
        eq(schema.permissions.id, schema.userPermissionMapping.permissionFk),
      )
      .where(
        and(
          eq(schema.userPermissionMapping.userFk, userId),
          eq(schema.userPermissionMapping.storeFk, sessionRow.activeStoreFk),
        ),
      );

    // Merge and deduplicate
    const allCodes = new Set<string>();
    roleBasedPerms.forEach((r) => allCodes.add(r.code));
    directPerms.forEach((r) => allCodes.add(r.code));

    return {
      isSuperAdmin: false,
      permissionCodes: Array.from(allCodes),
    };
  }
}
