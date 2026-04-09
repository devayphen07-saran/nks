import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, and, ilike, or, sql, isNull } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';
import { userRoleMapping } from '../../core/database/schema/auth/user-role-mapping';
import type {
  UserRoleRow,
  UserRoleWithStoreRow,
  AuthContextRow,
  RoutePermission,
  RouteWithPermissionsRow,
} from './dto/role-response.dto';

type Db = NodePgDatabase<typeof schema>;
type Role = typeof schema.roles.$inferSelect;

@Injectable()
export class RolesRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  // ─── System Role Helpers ──────────────────────────────────────────────────

  /**
   * Resolve the database ID for a system role by code.
   * System roles have storeFk = NULL and isEditable = false.
   */
  async findSystemRoleId(code: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.code, code),
          isNull(schema.roles.storeFk),
          eq(schema.roles.isActive, true),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  // ─── Auth Context Reads (consumed by AuthService / RBACGuard) ─────────────

  /**
   * Get all active roles for a user from user_role_mapping.
   * Returns both global (storeFk=null) and store-scoped roles.
   */
  async findUserRoles(userId: number): Promise<UserRoleRow[]> {
    const rows = await this.db
      .select({
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        isSystem: schema.roles.isSystem,
        storeFk: userRoleMapping.storeFk,
        isPrimary: userRoleMapping.isPrimary,
      })
      .from(userRoleMapping)
      .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .where(
        and(
          eq(userRoleMapping.userFk, userId),
          eq(userRoleMapping.isActive, true),
          isNull(userRoleMapping.deletedAt),
        ),
      );

    return rows.map((r) => ({
      roleId: r.roleId,
      roleCode: r.roleCode,
      isSystem: r.isSystem,
      storeFk: r.storeFk ?? null,
      isPrimary: r.isPrimary,
    }));
  }

  /**
   * Get all active roles for a user with store name included.
   */
  async findUserRolesWithCompany(userId: number): Promise<UserRoleWithStoreRow[]> {
    const rows = await this.db
      .select({
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        isSystem: schema.roles.isSystem,
        storeFk: userRoleMapping.storeFk,
        storeName: schema.store.storeName,
        isPrimary: userRoleMapping.isPrimary,
      })
      .from(userRoleMapping)
      .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
      .where(
        and(
          eq(userRoleMapping.userFk, userId),
          eq(userRoleMapping.isActive, true),
          isNull(userRoleMapping.deletedAt),
        ),
      );

    return rows.map((r) => ({
      roleId: r.roleId,
      roleCode: r.roleCode,
      isSystem: r.isSystem,
      storeFk: r.storeFk ?? null,
      storeName: r.storeName ?? null,
      isPrimary: r.isPrimary,
    }));
  }

  /** Get route permissions (path + CRUD flags) for a single role ID. */
  async findRoutePermissionsByRoleId(roleId: number): Promise<RoutePermission[]> {
    return this.db
      .select({
        routeId: schema.routes.id,
        routePath: schema.routes.routePath,
        routeName: schema.routes.routeName,
        routeScope: schema.routes.routeScope,
        canView: schema.roleRouteMapping.canView,
        canCreate: schema.roleRouteMapping.canCreate,
        canEdit: schema.roleRouteMapping.canEdit,
        canDelete: schema.roleRouteMapping.canDelete,
        canExport: schema.roleRouteMapping.canExport,
      })
      .from(schema.roleRouteMapping)
      .innerJoin(schema.routes, eq(schema.roleRouteMapping.routeFk, schema.routes.id))
      .where(
        and(
          eq(schema.roleRouteMapping.roleFk, roleId),
          eq(schema.roleRouteMapping.allow, true),
          isNull(schema.routes.deletedAt),
        ),
      )
      .orderBy(schema.routes.routeScope, schema.routes.sortOrder);
  }

  /** Get all allowed routes (with CRUD flags) for a set of role IDs. */
  async findRoutesByRoleIds(roleIds: number[]): Promise<RouteWithPermissionsRow[]> {
    if (roleIds.length === 0) return [];
    return this.db
      .selectDistinctOn([schema.routes.routePath], {
        id: schema.routes.id,
        routeName: schema.routes.routeName,
        routePath: schema.routes.routePath,
        fullPath: schema.routes.fullPath,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
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

  /** Find a role by exact code string. */
  async findByCode(code: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.code, code), eq(schema.roles.isActive, true)))
      .limit(1);
    return role ?? null;
  }

  /**
   * Check if user is SUPER_ADMIN and return active store from session.
   * Queries user_role_mapping instead of users.globalRole enum.
   */
  async getAuthContext(
    userId: number,
    sessionToken: string,
  ): Promise<AuthContextRow> {
    const superAdminRoleId = await this.findSystemRoleId('SUPER_ADMIN');

    if (superAdminRoleId) {
      const [saRow] = await this.db
        .select({ id: userRoleMapping.id })
        .from(userRoleMapping)
        .where(
          and(
            eq(userRoleMapping.userFk, userId),
            eq(userRoleMapping.roleFk, superAdminRoleId),
            isNull(userRoleMapping.storeFk),
            isNull(userRoleMapping.deletedAt),
            eq(userRoleMapping.isActive, true),
          ),
        )
        .limit(1);

      if (saRow) return { isSuperAdmin: true, activeStoreFk: null };
    }

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

    return {
      isSuperAdmin: false,
      activeStoreFk: sessionRow?.activeStoreFk ?? null,
    };
  }

  // ─── Role Assignment (user_role_mapping writes) ───────────────────────────

  /**
   * Assign a role to a user. Pass storeFk=null for platform-level roles.
   * isPrimary=true marks the role whose code flows into JWT.primaryRole.
   */
  async assignRole(
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    assignedBy: number | null,
    isPrimary: boolean,
    tx?: Db,
  ): Promise<typeof userRoleMapping.$inferSelect> {
    const client = tx ?? this.db;
    const [row] = await client
      .insert(userRoleMapping)
      .values({
        userFk,
        roleFk,
        storeFk: storeFk ?? undefined,
        assignedBy: assignedBy ?? undefined,
        isPrimary,
        isActive: true,
        assignedAt: new Date(),
      })
      .returning();
    return row;
  }

  /**
   * Soft-delete a specific role assignment for a user.
   */
  async removeRole(
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    tx?: Db,
  ): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(userRoleMapping)
      .set({ isActive: false, deletedAt: new Date() })
      .where(
        and(
          eq(userRoleMapping.userFk, userFk),
          eq(userRoleMapping.roleFk, roleFk),
          storeFk != null
            ? eq(userRoleMapping.storeFk, storeFk)
            : isNull(userRoleMapping.storeFk),
          isNull(userRoleMapping.deletedAt),
        ),
      );
  }

  /**
   * Soft-delete ALL role assignments for a user in a specific store.
   * Called when a user is removed from a store.
   */
  async removeAllStoreRoles(userFk: number, storeFk: number, tx?: Db): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(userRoleMapping)
      .set({ isActive: false, deletedAt: new Date() })
      .where(
        and(
          eq(userRoleMapping.userFk, userFk),
          eq(userRoleMapping.storeFk, storeFk),
          isNull(userRoleMapping.deletedAt),
        ),
      );
  }

  /**
   * Get all active role assignments for a user in a specific store.
   */
  async getActiveRolesForStore(userFk: number, storeFk: number): Promise<Pick<UserRoleRow, 'roleId' | 'roleCode' | 'isSystem' | 'isPrimary'>[]> {
    return this.db
      .select({
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        isSystem: schema.roles.isSystem,
        isPrimary: userRoleMapping.isPrimary,
      })
      .from(userRoleMapping)
      .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .where(
        and(
          eq(userRoleMapping.userFk, userFk),
          eq(userRoleMapping.storeFk, storeFk),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      );
  }

  // ─── Role checks ──────────────────────────────────────────────────────────

  /** Check if user has SUPER_ADMIN role. */
  async isSuperAdmin(userId: number): Promise<boolean> {
    const superAdminRoleId = await this.findSystemRoleId('SUPER_ADMIN');
    if (!superAdminRoleId) return false;

    const [row] = await this.db
      .select({ id: userRoleMapping.id })
      .from(userRoleMapping)
      .where(
        and(
          eq(userRoleMapping.userFk, userId),
          eq(userRoleMapping.roleFk, superAdminRoleId),
          isNull(userRoleMapping.storeFk),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      )
      .limit(1);

    return !!row;
  }

  /** Check if user is the STORE_OWNER of a specific store (checked via store.owner_user_fk). */
  async isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, storeId),
          eq(schema.store.ownerUserFk, userId),
          eq(schema.store.isActive, true),
        ),
      )
      .limit(1);

    return !!row;
  }

  // ─── Role CRUD (admin endpoints) ─────────────────────────────────────────

  /** List active roles with optional search and pagination. */
  async findAll(
    opts: { search?: string; page?: number; pageSize?: number } = {},
  ): Promise<{ rows: Role[]; total: number; page: number; pageSize: number }> {
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

  /** Find a role by guuid. */
  async findByGuuid(guuid: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.guuid, guuid), eq(schema.roles.isActive, true)))
      .limit(1);
    return role ?? null;
  }

  /** Find a role by numeric PK. */
  async findById(id: number): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.isActive, true)))
      .limit(1);
    return role ?? null;
  }

  /** Create a new role. */
  async create(data: typeof schema.roles.$inferInsert, tx?: Db): Promise<Role> {
    const client = tx ?? this.db;
    const [created] = await client
      .insert(schema.roles)
      .values(data)
      .returning();
    return created;
  }

  /** Update mutable role fields. */
  async update(
    id: number,
    data: Partial<typeof schema.roles.$inferInsert>,
    tx?: Db,
  ): Promise<Role | null> {
    const client = tx ?? this.db;
    const [updated] = await client
      .update(schema.roles)
      .set(data)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.isActive, true)))
      .returning();
    return updated ?? null;
  }

  /** Soft-delete a role. */
  async softDelete(id: number, deletedBy: number, tx?: Db): Promise<void> {
    const client = tx ?? this.db;
    await client
      .update(schema.roles)
      .set({ isActive: false, deletedAt: new Date(), deletedBy })
      .where(eq(schema.roles.id, id));
  }
}
