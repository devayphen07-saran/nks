import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../core/database/schema';
import { entityType } from '../../../../core/database/schema/lookups/entity-type/entity-type.table';
import { permissionAction } from '../../../../core/database/schema/rbac/permission-action/permission-action.table';
import { rolePermissions } from '../../../../core/database/schema/rbac/role-permissions/role-permissions.table';
import { eq, and, inArray, isNull, sql, or, gt, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  DynamicEntityPermissions,
  RoleEntityPermissions,
} from '../dto/role-response.dto';
import type { NewRolePermission } from '../../../../core/database/schema/rbac/role-permissions/role-permissions.table';

// ─── Row types ────────────────────────────────────────────────────────────────

export interface EntityTypeRow {
  id: number;
  code: string;
  label: string;
  description: string | null;
  parentCode: string | null;
  defaultAllow: boolean;
  sortOrder: number | null;
  isHidden: boolean;
}

/** Minimal route row used to build navigation trees. Mirrors PartialRoute in the routes context. */
export type RouteRow = {
  id: number;
  guuid: string;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: 'sidebar' | 'tab' | 'screen' | 'modal';
  routeScope: 'admin' | 'store';
  isPublic: boolean;
  isHidden: boolean;
  enable: boolean;
  parentRouteFk: number | null;
  fullPath: string;
  sortOrder: number | null;
  entityTypeFk: number | null;
  defaultAction: string | null;
  defaultAllow: boolean | null;
  hasAccess?: boolean;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BulkUpsertEntry {
  entityCode: string;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  canApprove?: boolean;
  canArchive?: boolean;
  deny?: boolean;
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * PermissionsRepository
 *
 * Read/write layer for the `role_permissions` table — the row-per-action
 * permission store. One row per (role, entity, action) triple.
 *
 * Action code cache:
 *   `onModuleInit()` loads the action code → PK map so `bulkUpsert()` avoids
 *   a per-call DB round-trip for code resolution. Call `refreshActionCache()`
 *   after inserting new rows into `permission_action` at runtime.
 */
@Injectable()
export class PermissionsRepository extends BaseRepository implements OnModuleInit {
  private readonly logger = new Logger(PermissionsRepository.name);

  // Uppercase action code ('VIEW', 'CREATE', …) → PK in permission_action.
  private actionCodeToId = new Map<string, number>();
  // Set of all active entity codes in entity_type — used by RBACGuard to
  // validate entityCode values in @RequireEntityPermission without a per-request DB query.
  private entityCodeSet = new Set<string>();

  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.refreshActionCache(),
      this.refreshEntityCache(),
    ]);
  }

  // ─── Cache ──────────────────────────────────────────────────────────────────

  /**
   * Reload action code → FK map from DB.
   * Call after inserting new rows into permission_action at runtime.
   */
  async refreshActionCache(): Promise<void> {
    const rows = await this.db
      .select({ id: permissionAction.id, code: permissionAction.code })
      .from(permissionAction)
      .where(
        and(
          eq(permissionAction.isActive, true),
          isNull(permissionAction.deletedAt),
        ),
      );
    this.actionCodeToId = new Map(rows.map((r) => [r.code, r.id]));
    this.logger.log(
      `Action cache refreshed: [${[...this.actionCodeToId.keys()].join(', ')}]`,
    );
  }

  /**
   * Reload entity code set from DB.
   * Call after inserting new rows into entity_type at runtime so new entities
   * are immediately usable in @RequireEntityPermission without a restart.
   */
  async refreshEntityCache(): Promise<void> {
    const rows = await this.db
      .select({ code: entityType.code })
      .from(entityType)
      .where(
        and(
          eq(entityType.isActive, true),
          isNull(entityType.deletedAt),
        ),
      );
    this.entityCodeSet = new Set(rows.map((r) => r.code));
    this.logger.log(
      `Entity cache refreshed: ${this.entityCodeSet.size} codes loaded`,
    );
  }

  /**
   * Returns true when `code` exists in the entity_type table.
   * Used by RBACGuard and PermissionEvaluatorService to validate entity codes
   * from @RequireEntityPermission before hitting the permission evaluation path.
   */
  isKnownEntityCode(code: string): boolean {
    return this.entityCodeSet.has(code);
  }

  // ─── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Bulk upsert permissions for a role.
   * Each entry expands into up to four rows (one per system action).
   * The `deny` flag is set on all action rows for the entity.
   *
   * Pass `tx` to run inside a caller-managed transaction so metadata and
   * permission writes are atomic (see RolesService.updateRoleByGuuid).
   *
   * @returns number of rows actually upserted (skips unknown entity/action codes)
   */
  async bulkUpsert(
    roleId: number,
    entries: BulkUpsertEntry[],
    tx?: NodePgDatabase<typeof schema>,
  ): Promise<number> {
    if (entries.length === 0) return 0;
    const client = tx ?? this.db;

    // 1 query: resolve all entity_type FKs at once.
    const codes = [...new Set(entries.map((e) => e.entityCode))];
    const typeRows = await client
      .select({ id: entityType.id, code: entityType.code })
      .from(entityType)
      .where(inArray(entityType.code, codes));
    const codeToEntityId = new Map(typeRows.map((r) => [r.code, r.id]));

    // Expand each entry into one row per system action.
    const ACTION_FIELDS: Array<[string, keyof BulkUpsertEntry]> = [
      ['VIEW',    'canView'],
      ['CREATE',  'canCreate'],
      ['EDIT',    'canEdit'],
      ['DELETE',  'canDelete'],
      ['EXPORT',  'canExport'],
      ['APPROVE', 'canApprove'],
      ['ARCHIVE', 'canArchive'],
    ];

    const rows: NewRolePermission[] = [];
    for (const entry of entries) {
      const entityTypeFk = codeToEntityId.get(entry.entityCode);
      if (!entityTypeFk) continue;

      for (const [actionCode, field] of ACTION_FIELDS) {
        const actionFk = this.actionCodeToId.get(actionCode);
        if (!actionFk) continue;

        rows.push({
          roleFk:       roleId,
          entityTypeFk,
          actionFk,
          allowed:  Boolean(entry[field] ?? false),
          deny:     Boolean(entry.deny ?? false),
          isActive: true,
        });
      }
    }

    if (rows.length === 0) return 0;

    // 1 query: batch INSERT ON CONFLICT DO UPDATE.
    await client
      .insert(rolePermissions)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          rolePermissions.roleFk,
          rolePermissions.entityTypeFk,
          rolePermissions.actionFk,
        ],
        set: {
          allowed:   sql`excluded.allowed`,
          deny:      sql`excluded.deny`,
          isActive:  true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

    return rows.length;
  }

  /**
   * Upsert a single extended action (e.g. EXPORT, APPROVE, ARCHIVE).
   * Use this for actions beyond the four system actions that bulkUpsert covers.
   * @returns false when entityCode or actionCode is not found in DB/cache
   */
  async upsertAction(
    roleId: number,
    entityCode: string,
    actionCode: string,
    allowed: boolean,
    deny = false,
  ): Promise<boolean> {
    const actionFk = this.actionCodeToId.get(actionCode.toUpperCase());
    if (!actionFk) return false;

    const [entityRow] = await this.db
      .select({ id: entityType.id })
      .from(entityType)
      .where(eq(entityType.code, entityCode))
      .limit(1);
    if (!entityRow) return false;

    await this.db
      .insert(rolePermissions)
      .values({
        roleFk:      roleId,
        entityTypeFk: entityRow.id,
        actionFk,
        allowed,
        deny,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [
          rolePermissions.roleFk,
          rolePermissions.entityTypeFk,
          rolePermissions.actionFk,
        ],
        set: {
          allowed,
          deny,
          isActive:  true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

    return true;
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Fetch and merge entity permissions for a set of role IDs.
   *
   * Returns a DynamicEntityPermissions map: entity code → { actions, deny }.
   * `actions` is an open record so any action code in the DB is present.
   *
   * Merge semantics (identical to legacy):
   *   - Any role with deny=true for an entity → hard block; all grants wiped.
   *   - Otherwise: OR across rows; any allowed=true for (entity, action) wins.
   */
  async getEntityPermissionsForRoleIds(
    roleIds: number[],
  ): Promise<DynamicEntityPermissions> {
    if (roleIds.length === 0) return {};

    const rows = await this.db
      .select({
        entityCode: entityType.code,
        actionCode: permissionAction.code,
        allowed:    rolePermissions.allowed,
        deny:       rolePermissions.deny,
      })
      .from(rolePermissions)
      .innerJoin(
        entityType,
        eq(rolePermissions.entityTypeFk, entityType.id),
      )
      .innerJoin(
        permissionAction,
        eq(rolePermissions.actionFk, permissionAction.id),
      )
      .where(
        and(
          inArray(rolePermissions.roleFk, roleIds),
          eq(rolePermissions.isActive, true),
          isNull(rolePermissions.deletedAt),
        ),
      );

    return this.mergePermissions(rows);
  }

  // ─── Entity Hierarchy ────────────────────────────────────────────────────────

  /**
   * Fetch all active entity types with their parent code resolved.
   * One self-join — parent alias is LEFT JOIN so root nodes (NULL parent) are included.
   * Excludes hidden entities so the UI editor only shows user-facing entities.
   */
  async getEntityTypeHierarchy(): Promise<EntityTypeRow[]> {
    const parent = alias(entityType, 'parent');

    const rows = await this.db
      .select({
        id:          entityType.id,
        code:        entityType.code,
        label:       entityType.label,
        description: entityType.description,
        parentCode:  parent.code,
        defaultAllow: entityType.defaultAllow,
        sortOrder:   entityType.sortOrder,
        isHidden:    entityType.isHidden,
      })
      .from(entityType)
      .leftJoin(parent, eq(entityType.parentEntityTypeFk, parent.id))
      .where(
        and(
          eq(entityType.isActive, true),
          isNull(entityType.deletedAt),
          eq(entityType.isHidden, false),
        ),
      );

    return rows.map((r) => ({
      id:          r.id,
      code:        r.code,
      label:       r.label,
      description: r.description,
      parentCode:  r.parentCode ?? null,
      defaultAllow: r.defaultAllow,
      sortOrder:   r.sortOrder,
      isHidden:    r.isHidden,
    }));
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * DENY > ALLOW — two explicit passes so the result is order-invariant:
   *
   * Pass 1: scan all rows to collect entities where ANY role has deny=true.
   * Pass 2: build action maps only for non-denied entities; OR across roles.
   *
   * A single-pass approach that clears actions when a deny row arrives works
   * but is harder to reason about (implicit order dependency in appearance).
   */
  private mergePermissions(
    rows: Array<{
      entityCode: string;
      actionCode: string;
      allowed: boolean;
      deny: boolean;
    }>,
  ): DynamicEntityPermissions {
    // Pass 1: entity-level deny wins regardless of which role or row order
    const deniedEntities = new Set<string>();
    for (const row of rows) {
      if (row.deny) deniedEntities.add(row.entityCode);
    }

    // Pass 2: grant actions for non-denied entities; OR across all roles
    const result: DynamicEntityPermissions = {};
    for (const row of rows) {
      const isDenied = deniedEntities.has(row.entityCode);
      if (!result[row.entityCode]) {
        result[row.entityCode] = { actions: {}, deny: isDenied };
      }
      if (isDenied) continue;
      result[row.entityCode].actions[row.actionCode] =
        (result[row.entityCode].actions[row.actionCode] ?? false) || row.allowed;
    }
    return result;
  }

  // ─── Legacy-compatible read helpers ────────────────────────────────────────
  // These return RoleEntityPermissions (the fixed canView/canCreate/canEdit/canDelete shape)
  // so callers that haven't migrated to DynamicEntityPermissions continue to work.

  /**
   * Permission map for a single role — used by getRoleWithPermissions response.
   * Converts dynamic row-per-action result into the fixed-column shape.
   */
  async getEntityPermissionMapForRole(roleId: number): Promise<RoleEntityPermissions> {
    const dynamic = await this.getEntityPermissionsForRoleIds([roleId]);
    return this.dynamicToLegacy(dynamic);
  }

  /**
   * Merged permissions for a user in a specific store.
   * Resolves the user's roles for that store then merges their permissions.
   */
  async getUserEntityPermissions(
    userId: number,
    storeId: number,
  ): Promise<RoleEntityPermissions> {
    const storeRoles = await this.db
      .select({ roleId: schema.userRoleMapping.roleFk })
      .from(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, storeId),
          eq(schema.userRoleMapping.isActive, true),
          isNull(schema.userRoleMapping.deletedAt),
          or(
            isNull(schema.userRoleMapping.expiresAt),
            gt(schema.userRoleMapping.expiresAt, new Date()),
          ),
        ),
      );

    const dynamic = await this.getEntityPermissionsForRoleIds(
      storeRoles.map((r) => r.roleId),
    );
    return this.dynamicToLegacy(dynamic);
  }

  /**
   * Per-store permission map for a user — one round-trip regardless of store count.
   *
   * Isolation: DENY in Store B never bleeds into Store A's permission set because
   * each store's roles are merged independently. A merged snapshot would let a
   * deny in one store suppress an allow the user legitimately holds in another.
   *
   * Returns a Map keyed by store guuid so callers never have to resolve IDs.
   */
  async getUserEntityPermissionsPerStore(
    userId: number,
    storeIds: number[],
  ): Promise<Record<string, RoleEntityPermissions>> {
    if (storeIds.length === 0) return {};

    const rows = await this.db
      .select({
        storeGuuid: schema.store.guuid,
        entityCode: entityType.code,
        actionCode: permissionAction.code,
        allowed: rolePermissions.allowed,
        deny: rolePermissions.deny,
      })
      .from(schema.userRoleMapping)
      .innerJoin(schema.store, eq(schema.userRoleMapping.storeFk, schema.store.id))
      .innerJoin(
        rolePermissions,
        and(
          eq(rolePermissions.roleFk, schema.userRoleMapping.roleFk),
          eq(rolePermissions.isActive, true),
          isNull(rolePermissions.deletedAt),
        ),
      )
      .innerJoin(entityType, eq(rolePermissions.entityTypeFk, entityType.id))
      .innerJoin(permissionAction, eq(rolePermissions.actionFk, permissionAction.id))
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          inArray(schema.userRoleMapping.storeFk, storeIds),
          eq(schema.userRoleMapping.isActive, true),
          isNull(schema.userRoleMapping.deletedAt),
          or(
            isNull(schema.userRoleMapping.expiresAt),
            gt(schema.userRoleMapping.expiresAt, new Date()),
          ),
        ),
      );

    // Partition rows by store then merge with DENY > ALLOW per store
    const storeToRows: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!row.storeGuuid) continue;
      (storeToRows[row.storeGuuid] ??= []).push(row);
    }

    const result: Record<string, RoleEntityPermissions> = {};
    for (const [storeGuuid, storeRows] of Object.entries(storeToRows)) {
      result[storeGuuid] = this.dynamicToLegacy(this.mergePermissions(storeRows));
    }
    return result;
  }

  // ─── Route queries (merged from RoutesRepository) ────────────────────────────

  /** Minimal route row returned by route queries — used to build navigation trees. */
  // (Kept local to avoid importing from the routes bounded context.)

  async findStoreByGuuid(guuid: string): Promise<{ id: number } | null> {
    const [store] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(and(eq(schema.store.guuid, guuid), eq(schema.store.isActive, true), isNull(schema.store.deletedAt)))
      .limit(1);
    return store ?? null;
  }

  async findAdminRoutesByRoleIds(roleIds: number[]): Promise<RouteRow[]> {
    return this.findRoutesByScope(roleIds, 'admin');
  }

  async findCustomRoleRoutes(roleIds: number[]): Promise<RouteRow[]> {
    return this.findRoutesByScope(roleIds, 'store');
  }

  /**
   * Shared query for admin and store route trees.
   * Uses GROUP BY + bool_or() so multiple roles mapping to the same route
   * merge flags with "most-permissive wins" semantics.
   */
  private findRoutesByScope(roleIds: number[], scope: 'admin' | 'store'): Promise<RouteRow[]> {
    return this.db
      .select({
        id:           schema.routes.id,
        guuid:        schema.routes.guuid,
        routePath:    schema.routes.routePath,
        routeName:    schema.routes.routeName,
        description:  schema.routes.description,
        iconName:     schema.routes.iconName,
        routeType:    schema.routes.routeType,
        routeScope:   schema.routes.routeScope,
        isPublic:     schema.routes.isPublic,
        isHidden:     schema.routes.isHidden,
        enable:       schema.routes.enable,
        parentRouteFk: schema.routes.parentRouteFk,
        fullPath:     schema.routes.fullPath,
        sortOrder:    schema.routes.sortOrder,
        entityTypeFk: schema.routes.entityTypeFk,
        defaultAction: schema.routes.defaultAction,
        defaultAllow: entityType.defaultAllow,
      })
      .from(schema.routes)
      .innerJoin(
        schema.roleRouteMapping,
        and(
          eq(schema.roleRouteMapping.routeFk, schema.routes.id),
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      )
      .leftJoin(entityType, eq(schema.routes.entityTypeFk, entityType.id))
      .where(and(
        isNull(schema.routes.deletedAt),
        eq(schema.routes.routeScope, scope),
        eq(schema.routes.enable, true),
        eq(schema.routes.isHidden, false),
      ))
      .groupBy(
        schema.routes.id, schema.routes.guuid, schema.routes.routePath,
        schema.routes.routeName, schema.routes.description, schema.routes.iconName,
        schema.routes.routeType, schema.routes.routeScope, schema.routes.isPublic,
        schema.routes.isHidden, schema.routes.enable, schema.routes.parentRouteFk,
        schema.routes.fullPath, schema.routes.sortOrder, schema.routes.entityTypeFk,
        schema.routes.defaultAction, entityType.defaultAllow,
      )
      .orderBy(asc(schema.routes.sortOrder), asc(schema.routes.id)) as Promise<RouteRow[]>;
  }

  async findUserEntityPermissions(roleIds: number[]): Promise<Map<number, Set<string>>> {
    if (roleIds.length === 0) return new Map();
    const rows = await this.db
      .select({ entityTypeFk: rolePermissions.entityTypeFk, actionCode: permissionAction.code })
      .from(rolePermissions)
      .innerJoin(permissionAction, eq(permissionAction.id, rolePermissions.actionFk))
      .where(and(
        inArray(rolePermissions.roleFk, roleIds),
        eq(rolePermissions.allowed, true),
        eq(rolePermissions.deny, false),
        isNull(rolePermissions.deletedAt),
      ));
    const map = new Map<number, Set<string>>();
    for (const { entityTypeFk, actionCode } of rows) {
      let actions = map.get(entityTypeFk);
      if (!actions) { actions = new Set(); map.set(entityTypeFk, actions); }
      actions.add(actionCode.toUpperCase());
    }
    return map;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Convert DynamicEntityPermissions → RoleEntityPermissions (fixed-column shape). */
  private dynamicToLegacy(dynamic: DynamicEntityPermissions): RoleEntityPermissions {
    const result: RoleEntityPermissions = {};
    for (const [code, entry] of Object.entries(dynamic)) {
      result[code] = {
        canView:    entry.actions['VIEW']    === true,
        canCreate:  entry.actions['CREATE']  === true,
        canEdit:    entry.actions['EDIT']    === true,
        canDelete:  entry.actions['DELETE']  === true,
        canExport:  entry.actions['EXPORT']  === true,
        canApprove: entry.actions['APPROVE'] === true,
        canArchive: entry.actions['ARCHIVE'] === true,
        deny:       entry.deny,
      };
    }
    return result;
  }
}
