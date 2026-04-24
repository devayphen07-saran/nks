import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../core/database/schema';
import { entityType } from '../../../../core/database/schema/lookups/entity-type/entity-type.table';
import { permissionAction } from '../../../../core/database/schema/rbac/permission-action/permission-action.table';
import { rolePermissions } from '../../../../core/database/schema/rbac/role-permissions/role-permissions.table';
import { eq, and, inArray, isNull, sql, or, gt } from 'drizzle-orm';
import type {
  DynamicEntityPermissions,
  DynamicEntityPermissionEntry,
  RoleEntityPermissions,
} from '../dto/role-response.dto';
import type { NewRolePermission } from '../../../../core/database/schema/rbac/role-permissions/role-permissions.table';

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
 * RolePermissionsRepository
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
export class RolePermissionsRepository extends BaseRepository implements OnModuleInit {
  private readonly logger = new Logger(RolePermissionsRepository.name);

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
      ['VIEW',   'canView'],
      ['CREATE', 'canCreate'],
      ['EDIT',   'canEdit'],
      ['DELETE', 'canDelete'],
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

  // ─── Private helpers ────────────────────────────────────────────────────────

  private mergePermissions(
    rows: Array<{
      entityCode: string;
      actionCode: string;
      allowed: boolean;
      deny: boolean;
    }>,
  ): DynamicEntityPermissions {
    const result: DynamicEntityPermissions = {};

    for (const row of rows) {
      if (!result[row.entityCode]) {
        result[row.entityCode] = { actions: {}, deny: false };
      }
      const entry: DynamicEntityPermissionEntry = result[row.entityCode];

      if (row.deny) {
        entry.deny = true;
        entry.actions = {};
      } else if (!entry.deny) {
        entry.actions[row.actionCode] =
          (entry.actions[row.actionCode] ?? false) || row.allowed;
      }
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
   * Batched merged permissions across multiple stores.
   * Resolves all role assignments in one query then merges in a second query —
   * N+1 safe regardless of store count.
   */
  async getUserEntityPermissionsForAllStores(
    userId: number,
    storeIds: number[],
  ): Promise<RoleEntityPermissions> {
    if (storeIds.length === 0) return {};

    const storeRoles = await this.db
      .select({ roleId: schema.userRoleMapping.roleFk })
      .from(schema.userRoleMapping)
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

    if (storeRoles.length === 0) return {};

    const roleIds = [...new Set(storeRoles.map((r) => r.roleId))];
    const dynamic = await this.getEntityPermissionsForRoleIds(roleIds);
    return this.dynamicToLegacy(dynamic);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Convert DynamicEntityPermissions → RoleEntityPermissions (fixed-column shape). */
  private dynamicToLegacy(dynamic: DynamicEntityPermissions): RoleEntityPermissions {
    const result: RoleEntityPermissions = {};
    for (const [code, entry] of Object.entries(dynamic)) {
      result[code] = {
        canView:   entry.actions['VIEW']   === true,
        canCreate: entry.actions['CREATE'] === true,
        canEdit:   entry.actions['EDIT']   === true,
        canDelete: entry.actions['DELETE'] === true,
        deny:      entry.deny,
      };
    }
    return result;
  }
}
