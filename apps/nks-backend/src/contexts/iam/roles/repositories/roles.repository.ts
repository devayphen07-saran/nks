import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  eq,
  inArray,
  and,
  or,
  isNull,
  gt,
  count,
  asc,
  desc,
  sql,
} from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm/column';
import { ilikeAny } from '../../../../core/database/query-helpers';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { userRoleMapping } from '../../../../core/database/schema/auth/user-role-mapping';
import type {
  UserRoleRow,
  UserRoleWithStoreRow,
  RoutePermission,
  RouteWithPermissionsRow,
} from '../dto/role-response.dto';

type Db = NodePgDatabase<typeof schema>;
type Role = typeof schema.roles.$inferSelect;

@Injectable()
export class RolesRepository extends BaseRepository {
  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  // ─── System Role Helpers ──────────────────────────────────────────────────

  /**
   * Resolve the database ID for a system role by code.
   * System roles have storeFk = NULL and isEditable = false.
   * Pass tx parameter to use within a transaction (useful for atomic first-user role assignment).
   */
  async findSystemRoleId(code: string, tx?: Db): Promise<number | null> {
    const client = tx ?? this.db;
    const [row] = await client
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.code, code.toUpperCase()),
          isNull(schema.roles.storeFk),
          eq(schema.roles.isActive, true),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  // ─── Auth Context Reads (consumed by AuthService / RBACGuard) ─────────────

  /**
   * Get all active roles for a user with store name included.
   *
   * user_role_mapping is the single source of truth for all roles:
   * - Platform-level roles (SUPER_ADMIN, USER) have storeFk = NULL (storeName = null)
   * - Store-scoped roles (STORE_OWNER, STAFF, custom roles) have storeFk = storeId
   */
  async findUserRoles(userId: number): Promise<UserRoleWithStoreRow[]> {
    return this.db
      .select({
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        isSystem: schema.roles.isSystem,
        storeFk: userRoleMapping.storeFk,
        storeGuuid: schema.store.guuid,
        storeName: schema.store.storeName,
        isPrimary: userRoleMapping.isPrimary,
      })
      .from(userRoleMapping)
      .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
      .where(this.activeRoleMappingCondition(userId));
  }

  /**
   * Fetch active roles for a user with the assignedAt/expiresAt fields needed by AuthGuard
   * to build the SessionUser.roles array. Structurally identical to findUserRoles() but
   * includes temporal grant metadata that the auth context requires.
   */
  async findUserRolesForAuth(userId: number): Promise<
    Array<{
      roleId: number;
      roleCode: string;
      storeFk: number | null;
      storeGuuid: string | null;
      storeName: string | null;
      isPrimary: boolean;
      assignedAt: Date;
      expiresAt: Date | null;
    }>
  > {
    return this.db
      .select({
        roleId: userRoleMapping.roleFk,
        roleCode: schema.roles.code,
        storeFk: userRoleMapping.storeFk,
        storeGuuid: schema.store.guuid,
        storeName: schema.store.storeName,
        isPrimary: userRoleMapping.isPrimary,
        assignedAt: userRoleMapping.assignedAt,
        expiresAt: userRoleMapping.expiresAt,
      })
      .from(userRoleMapping)
      .innerJoin(schema.roles, eq(userRoleMapping.roleFk, schema.roles.id))
      .leftJoin(schema.store, eq(userRoleMapping.storeFk, schema.store.id))
      .where(this.activeRoleMappingCondition(userId));
  }

  /** Get route permissions (path + CRUD flags) for a single role ID. */
  async findRoutePermissionsByRoleId(
    roleId: number,
  ): Promise<RoutePermission[]> {
    return this.db
      .select({
        routeGuuid: schema.routes.guuid,
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
      .innerJoin(
        schema.routes,
        eq(schema.roleRouteMapping.routeFk, schema.routes.id),
      )
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
  async findRoutesByRoleIds(
    roleIds: number[],
  ): Promise<RouteWithPermissionsRow[]> {
    if (roleIds.length === 0) return [];
    return this.db
      .select({
        guuid: schema.routes.guuid,
        routeName: schema.routes.routeName,
        routePath: schema.routes.routePath,
        fullPath: schema.routes.fullPath,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
        isPublic: schema.routes.isPublic,
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
          isNull(schema.routes.deletedAt),
        ),
      )
      .orderBy(schema.routes.routePath, schema.routes.sortOrder);
  }

  /** Find a role by exact code string. */
  async findByCode(code: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.code, code.toUpperCase()),
          eq(schema.roles.isActive, true),
        ),
      )
      .limit(1);
    return role ?? null;
  }

  // ─── Role Assignment (user_role_mapping writes) ───────────────────────────

  /**
   * Assign a role to a user. Pass storeFk=null for platform-level roles.
   * isPrimary=true marks the role whose code flows into JWT.primaryRole.
   * Idempotent: returns null (no-op) if the assignment already exists.
   */
  async assignRole(
    userFk: number,
    roleFk: number,
    storeFk: number | null,
    assignedBy: number | null,
    isPrimary: boolean,
    tx?: Db,
    expiresAt?: Date | null,
  ): Promise<typeof userRoleMapping.$inferSelect | null> {
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
        expiresAt: expiresAt ?? undefined,
      })
      .onConflictDoNothing()
      .returning();
    return row ?? null;
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
  async removeAllStoreRoles(
    userFk: number,
    storeFk: number,
    tx?: Db,
  ): Promise<void> {
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
   * Excludes expired temporary grants (expiresAt IS NULL OR expiresAt > NOW).
   */
  async getActiveRolesForStore(
    userFk: number,
    storeFk: number,
  ): Promise<
    Pick<UserRoleRow, 'roleId' | 'roleCode' | 'isSystem' | 'isPrimary'>[]
  > {
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
          or(
            isNull(userRoleMapping.expiresAt),
            gt(userRoleMapping.expiresAt, new Date()),
          ),
        ),
      );
  }

  // ─── Store resolution ─────────────────────────────────────────────────────

  async findStoreIdByGuuid(guuid: string): Promise<number | null> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.guuid, guuid),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async getStoreGuuidByFk(storeFk: number): Promise<string | null> {
    const [row] = await this.db
      .select({ guuid: schema.store.guuid })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, storeFk),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return row?.guuid ?? null;
  }

  // ─── Role checks ──────────────────────────────────────────────────────────

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

  /** List roles with optional search, pagination, sorting, and active filter. */
  async findAll(
    opts: {
      search?: string;
      page?: number;
      pageSize?: number;
      storeId?: number | null;
      sortBy?: string;
      sortOrder?: string;
      isActive?: boolean;
    } = {},
  ): Promise<{ rows: Role[]; total: number; page: number; pageSize: number }> {
    const {
      search,
      page = 1,
      pageSize = 50,
      storeId,
      sortBy = 'name',
      sortOrder = 'asc',
      isActive,
    } = opts;
    const offset = RolesRepository.toOffset(page, pageSize);
    const activeFilter = isActive === undefined ? true : isActive;

    const where = and(
      eq(schema.roles.isActive, activeFilter),
      ilikeAny(
        search,
        schema.roles.code,
        schema.roles.roleName,
        schema.roles.description,
      ),
      storeId
        ? or(isNull(schema.roles.storeFk), eq(schema.roles.storeFk, storeId))
        : undefined,
    );

    const { rows, total } = await this.paginate(
      this.db
        .select()
        .from(schema.roles)
        .where(where)
        .orderBy(
          this.applySortDirection(this.getRoleOrderColumn(sortBy), sortOrder),
        )
        .limit(pageSize)
        .offset(offset),
      () => this.db.select({ total: count() }).from(schema.roles).where(where),
      page, pageSize,
    );

    return { rows, total, page, pageSize };
  }

  /** Find a role by guuid. */
  async findByGuuid(guuid: string): Promise<Role | null> {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(
        and(eq(schema.roles.guuid, guuid), eq(schema.roles.isActive, true)),
      )
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
      .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)));
  }

  /**
   * Check whether any active user is assigned a given role.
   * Used for SUPER_ADMIN seeding check.
   */
  async hasUserWithRole(roleId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userRoleMapping.id })
      .from(userRoleMapping)
      .where(
        and(
          eq(userRoleMapping.roleFk, roleId),
          isNull(userRoleMapping.storeFk),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      )
      .limit(1);

    return !!row;
  }

  /**
   * Find the primary store (STORE_OWNER) for a user.
   * Returns the store guuid, or null if the user owns no store.
   */
  async findPrimaryStoreForUser(
    userId: number,
    storeOwnerRoleId: number,
  ): Promise<{ guuid: string } | null> {
    const [row] = await this.db
      .select({ guuid: schema.store.guuid })
      .from(userRoleMapping)
      .innerJoin(schema.store, eq(schema.store.id, userRoleMapping.storeFk))
      .where(
        and(
          eq(userRoleMapping.userFk, userId),
          eq(userRoleMapping.roleFk, storeOwnerRoleId),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Find all active user IDs that hold a specific role.
   * Used to fan-out permission changelog entries when a role's entity permissions change.
   */
  async findUsersByRoleId(roleId: number): Promise<number[]> {
    const rows = await this.db
      .select({ userFk: userRoleMapping.userFk })
      .from(userRoleMapping)
      .where(
        and(
          eq(userRoleMapping.roleFk, roleId),
          eq(userRoleMapping.isActive, true),
          isNull(userRoleMapping.deletedAt),
        ),
      );

    return rows.map((r) => r.userFk);
  }

  /**
   * Assign a role to a user inside an existing transaction.
   * Idempotent: silently no-ops if the assignment already exists.
   */
  async assignRoleWithinTransaction(
    tx: Db,
    userId: number,
    roleCode: string,
  ): Promise<boolean> {
    const [roleRecord] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.code, roleCode.toUpperCase()),
          isNull(schema.roles.storeFk),
        ),
      )
      .limit(1);

    if (!roleRecord) return false;

    await tx
      .insert(userRoleMapping)
      .values({
        userFk: userId,
        roleFk: roleRecord.id,
        isPrimary: true,
        isActive: true,
      })
      .onConflictDoNothing();

    return true;
  }

  /**
   * Check if any active SUPER_ADMIN user exists (non-transactional read).
   * Used to gate OTP registration — OTP users cannot register until an admin exists.
   */
  async hasSuperAdmin(superAdminRoleId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userRoleMapping.id })
      .from(userRoleMapping)
      .where(
        and(
          eq(userRoleMapping.roleFk, superAdminRoleId),
          isNull(userRoleMapping.storeFk),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      )
      .limit(1);
    return !!row;
  }

  /**
   * Resolve the initial role for a new user within a transaction.
   * Returns 'SUPER_ADMIN' if no SUPER_ADMIN exists yet, else 'USER'.
   *
   * RACE PROTECTION: acquires a PostgreSQL transaction-level advisory lock
   * (auto-released at transaction end) before reading. Two concurrent
   * first-registrations will serialize here — only one sees 0 rows.
   * hashtext('super_admin_bootstrap') produces a stable, namespaced lock ID.
   */
  async resolveInitialRoleWithinTransaction(
    tx: Db,
    superAdminRoleId: number,
  ): Promise<'SUPER_ADMIN' | 'USER'> {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('super_admin_bootstrap'))`,
    );

    const existing = await tx
      .select({ id: userRoleMapping.id })
      .from(userRoleMapping)
      .where(
        and(
          eq(userRoleMapping.roleFk, superAdminRoleId),
          isNull(userRoleMapping.storeFk),
          isNull(userRoleMapping.deletedAt),
          eq(userRoleMapping.isActive, true),
        ),
      )
      .limit(1);

    return existing.length > 0 ? 'USER' : 'SUPER_ADMIN';
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private getRoleOrderColumn(sortBy: string = 'name') {
    switch (sortBy) {
      case 'code':
        return schema.roles.code;
      case 'createdAt':
        return schema.roles.createdAt;
      case 'name':
      default:
        return schema.roles.roleName;
    }
  }

  private applySortDirection(column: AnyColumn, sortOrder: string = 'asc') {
    return sortOrder === 'desc' ? desc(column) : asc(column);
  }

  private activeRoleMappingCondition(userId: number) {
    return and(
      eq(userRoleMapping.userFk, userId),
      eq(userRoleMapping.isActive, true),
      isNull(userRoleMapping.deletedAt),
      or(
        isNull(userRoleMapping.expiresAt),
        gt(userRoleMapping.expiresAt, new Date()),
      ),
    );
  }
}
