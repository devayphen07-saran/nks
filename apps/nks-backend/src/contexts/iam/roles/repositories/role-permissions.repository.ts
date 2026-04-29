import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { DbTransaction } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import { entityType } from '../../../../core/database/schema/lookups/entity-type/entity-type.table';
import { rolePermissions } from '../../../../core/database/schema/rbac/role-permissions/role-permissions.table';
import { eq, and, inArray, isNull, sql, or, gt, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { RoleEntityPermissions } from '../dto/role-response.dto';
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
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BulkUpsertEntry {
  entityCode: string;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  deny?: boolean;
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * PermissionsRepository
 *
 * Read/write layer for the `role_permissions` table.
 * One wide row per (role, entity) with boolean columns for each action.
 * Merge rule across roles: OR for grants, OR for deny (deny wins).
 */
@Injectable()
export class PermissionsRepository extends BaseRepository implements OnModuleInit {
  private readonly logger = new Logger(PermissionsRepository.name);

  private entityCodeSet = new Set<string>();

  constructor(@InjectDb() db: NodePgDatabase<typeof schema>) {
    super(db);
  }

  async onModuleInit(): Promise<void> {
    await this.refreshEntityCache();
  }

  // ─── Cache ──────────────────────────────────────────────────────────────────

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
    this.logger.log(`Entity cache refreshed: ${this.entityCodeSet.size} codes loaded`);
  }

  isKnownEntityCode(code: string): boolean {
    return this.entityCodeSet.has(code);
  }

  // ─── Writes ─────────────────────────────────────────────────────────────────

  /**
   * Bulk upsert permissions for a role — one row per entity.
   * Pass `tx` to run inside a caller-managed transaction.
   * @param roleId - The role being updated
   * @param entries - Permission entries to upsert
   * @param modifiedBy - User ID of who is modifying these permissions (for audit trail)
   * @param tx - Optional transaction context
   * @returns number of rows upserted (skips unknown entity codes)
   */
  async bulkUpsert(
    roleId: number,
    entries: BulkUpsertEntry[],
    modifiedBy: number,
    tx?: DbTransaction,
  ): Promise<number> {
    if (entries.length === 0) return 0;
    const client = tx ?? this.db;

    const codes = [...new Set(entries.map((e) => e.entityCode))];
    const typeRows = await client
      .select({ id: entityType.id, code: entityType.code })
      .from(entityType)
      .where(inArray(entityType.code, codes));
    const codeToEntityId = new Map(typeRows.map((r) => [r.code, r.id]));

    const rows: NewRolePermission[] = [];
    for (const entry of entries) {
      const entityTypeFk = codeToEntityId.get(entry.entityCode);
      if (!entityTypeFk) continue;
      rows.push({
        roleFk:       roleId,
        entityTypeFk,
        allow:     !entry.deny,
        canView:   entry.canView   ?? false,
        canCreate: entry.canCreate ?? false,
        canEdit:   entry.canEdit   ?? false,
        canDelete: entry.canDelete ?? false,
        deny:      entry.deny      ?? false,
        isActive:  true,
      });
    }

    if (rows.length === 0) return 0;

    await client
      .insert(rolePermissions)
      .values(rows)
      .onConflictDoUpdate({
        target: [rolePermissions.roleFk, rolePermissions.entityTypeFk],
        set: {
          allow:     sql`excluded.allow`,
          canView:   sql`excluded.can_view`,
          canCreate: sql`excluded.can_create`,
          canEdit:   sql`excluded.can_edit`,
          canDelete: sql`excluded.can_delete`,
          deny:      sql`excluded.deny`,
          isActive:  true,
          deletedAt: null,
        },
      });

    return rows.length;
  }

  // ─── Reads ──────────────────────────────────────────────────────────────────

  /**
   * Fetch and merge entity permissions for a set of role IDs.
   * Returns RoleEntityPermissions keyed by entity code.
   * Deny wins: any role with deny=true for an entity blocks all grants.
   */
  async getEntityPermissionsForRoleIds(
    roleIds: number[],
  ): Promise<RoleEntityPermissions> {
    if (roleIds.length === 0) return {};

    const rows = await this.db
      .select({
        entityCode: entityType.code,
        canView:    rolePermissions.canView,
        canCreate:  rolePermissions.canCreate,
        canEdit:    rolePermissions.canEdit,
        canDelete:  rolePermissions.canDelete,
        deny:       rolePermissions.deny,
      })
      .from(rolePermissions)
      .innerJoin(entityType, eq(rolePermissions.entityTypeFk, entityType.id))
      .where(
        and(
          inArray(rolePermissions.roleFk, roleIds),
          eq(rolePermissions.isActive, true),
          isNull(rolePermissions.deletedAt),
        ),
      );

    return this.mergePermissions(rows);
  }

  /**
   * Permission map for a single role — used by getRoleWithPermissions response.
   */
  async getEntityPermissionMapForRole(roleId: number): Promise<RoleEntityPermissions> {
    return this.getEntityPermissionsForRoleIds([roleId]);
  }

  /**
   * Merged permissions for a user in a specific store.
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

    return this.getEntityPermissionsForRoleIds(storeRoles.map((r) => r.roleId));
  }

  /**
   * Per-store permission map for a user — one round-trip regardless of store count.
   * DENY in Store B never bleeds into Store A (each store merged independently).
   */
  async getUserEntityPermissionsPerStore(
    userId: number,
    storeIds: number[],
  ): Promise<Record<string, RoleEntityPermissions>> {
    if (storeIds.length === 0) return {};

    const rows = await this.db
      .select({
        storeGuuid:  schema.store.guuid,
        entityCode:  entityType.code,
        canView:     rolePermissions.canView,
        canCreate:   rolePermissions.canCreate,
        canEdit:     rolePermissions.canEdit,
        canDelete:   rolePermissions.canDelete,
        deny:        rolePermissions.deny,
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

    const storeToRows: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!row.storeGuuid) continue;
      (storeToRows[row.storeGuuid] ??= []).push(row);
    }

    const result: Record<string, RoleEntityPermissions> = {};
    for (const [storeGuuid, storeRows] of Object.entries(storeToRows)) {
      result[storeGuuid] = this.mergePermissions(storeRows);
    }
    return result;
  }

  // ─── Entity Hierarchy ────────────────────────────────────────────────────────

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

  // ─── Route queries ────────────────────────────────────────────────────────────

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

  /**
   * Returns a Map<entityTypeFk, Set<actionCode>> for annotateRoutePermissions.
   * Action strings match the defaultAction values stored on routes ('VIEW', 'CREATE', etc.)
   * Deny: if any role has deny=true for an entity, that entity is excluded from the map.
   */
  async findUserEntityPermissions(roleIds: number[]): Promise<Map<number, Set<string>>> {
    if (roleIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        entityTypeFk: rolePermissions.entityTypeFk,
        canView:      rolePermissions.canView,
        canCreate:    rolePermissions.canCreate,
        canEdit:      rolePermissions.canEdit,
        canDelete:    rolePermissions.canDelete,
        deny:         rolePermissions.deny,
      })
      .from(rolePermissions)
      .where(and(
        inArray(rolePermissions.roleFk, roleIds),
        eq(rolePermissions.isActive, true),
        isNull(rolePermissions.deletedAt),
      ));

    // Two passes: collect denies, then build action sets
    const denied = new Set<number>();
    for (const row of rows) {
      if (row.deny) denied.add(row.entityTypeFk);
    }

    const map = new Map<number, Set<string>>();
    for (const row of rows) {
      if (denied.has(row.entityTypeFk)) continue;
      let actions = map.get(row.entityTypeFk);
      if (!actions) { actions = new Set(); map.set(row.entityTypeFk, actions); }
      if (row.canView)   actions.add('VIEW');
      if (row.canCreate) actions.add('CREATE');
      if (row.canEdit)   actions.add('EDIT');
      if (row.canDelete) actions.add('DELETE');
    }
    return map;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Merge permission rows (potentially from multiple roles) into one map.
   * Deny wins: if any role denies an entity, all grants for that entity are wiped.
   * Grants: OR across roles.
   */
  private mergePermissions(
    rows: Array<{
      entityCode: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      deny: boolean;
    }>,
  ): RoleEntityPermissions {
    const denied = new Set<string>();
    for (const row of rows) {
      if (row.deny) denied.add(row.entityCode);
    }

    const result: RoleEntityPermissions = {};
    for (const row of rows) {
      const isDenied = denied.has(row.entityCode);
      if (!result[row.entityCode]) {
        result[row.entityCode] = { canView: false, canCreate: false, canEdit: false, canDelete: false, deny: isDenied };
      }
      if (isDenied) continue;
      const entry = result[row.entityCode];
      entry.canView   = entry.canView   || row.canView;
      entry.canCreate = entry.canCreate || row.canCreate;
      entry.canEdit   = entry.canEdit   || row.canEdit;
      entry.canDelete = entry.canDelete || row.canDelete;
    }
    return result;
  }
}
