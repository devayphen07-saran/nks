import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, inArray, and, ilike, or, sql, isNull, gt } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { userRoleMapping } from '../../../core/database/schema/auth/user-role-mapping';
import type {
  UserRoleRow,
  UserRoleWithStoreRow,
  RoutePermission,
  RouteWithPermissionsRow,
} from '../dto/role-response.dto';

type Db = NodePgDatabase<typeof schema>;
type Role = typeof schema.roles.$inferSelect;

@Injectable()
export class RolesRepository {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

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
          or(isNull(userRoleMapping.expiresAt), gt(userRoleMapping.expiresAt, new Date())),
        ),
      );
  }

  /** Get route permissions (path + CRUD flags) for a single role ID. */
  async findRoutePermissionsByRoleId(
    roleId: number,
  ): Promise<RoutePermission[]> {
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
    expiresAt?: Date | null,
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
        expiresAt: expiresAt ?? undefined,
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
          // Exclude expired temporary grants
          or(isNull(userRoleMapping.expiresAt), gt(userRoleMapping.expiresAt, new Date())),
        ),
      );
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
      .where(eq(schema.roles.id, id));
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
   * Used during registration to atomically assign the initial role.
   */
  async assignRoleWithinTransaction(
    tx: Db,
    userId: number,
    roleCode: string,
  ): Promise<void> {
    const [roleRecord] = await tx
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(and(eq(schema.roles.code, roleCode), isNull(schema.roles.storeFk)))
      .limit(1);

    if (!roleRecord) {
      throw new InternalServerErrorException(
        `assignRoleWithinTransaction: system role '${roleCode}' not found in database`,
      );
    }

    await tx.insert(userRoleMapping).values({
      userFk: userId,
      roleFk: roleRecord.id,
      isPrimary: true,
      isActive: true,
    });
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
   * Check if SUPER_ADMIN is already assigned within a transaction (FOR UPDATE lock).
   * Returns the role code to assign: 'SUPER_ADMIN' if first user, else 'USER'.
   */
  async resolveInitialRoleWithinTransaction(
    tx: Db,
    superAdminRoleId: number,
  ): Promise<'SUPER_ADMIN' | 'USER'> {
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
}
