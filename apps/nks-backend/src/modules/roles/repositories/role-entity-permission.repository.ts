import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { entityType } from '../../../core/database/schema/lookups/entity-type/entity-type.table';
import { roleEntityPermission } from '../../../core/database/schema/rbac/role-entity-permission/role-entity-permission.table';
import { eq, and, inArray, isNull, sql, gt, or } from 'drizzle-orm';
import { RolesRepository } from './roles.repository';
import type {
  EntityPermission,
  RoleEntityPermissions,
} from '../dto/role-response.dto';


@Injectable()
export class RoleEntityPermissionRepository {
  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly rolesRepository: RolesRepository,
  ) {}

  /**
   * Create or update entity permission for a role.
   * Accepts entityCode string and looks up entity_type to find FK.
   * @returns false if entity type not found, true on success
   */
  async upsertPermission(
    roleId: number,
    entityCode: string,
    permission: Partial<EntityPermission>,
  ): Promise<boolean> {
    const entityTypeId = await this.resolveEntityTypeId(entityCode);
    if (!entityTypeId) {
      return false;
    }

    // Single atomic upsert — eliminates the select+insert/update race condition.
    // ON CONFLICT: restore soft-deleted rows (isActive, deletedAt) and keep existing
    // column values when the caller omits a field (sql`table.col` = current value).
    await this.db
      .insert(roleEntityPermission)
      .values({
        roleFk: roleId,
        entityTypeFk: entityTypeId,
        canView: permission.canView ?? false,
        canCreate: permission.canCreate ?? false,
        canEdit: permission.canEdit ?? false,
        canDelete: permission.canDelete ?? false,
        deny: permission.deny ?? false,
        isActive: true,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: [roleEntityPermission.roleFk, roleEntityPermission.entityTypeFk],
        set: {
          canView: permission.canView ?? sql`role_entity_permission.can_view`,
          canCreate: permission.canCreate ?? sql`role_entity_permission.can_create`,
          canEdit: permission.canEdit ?? sql`role_entity_permission.can_edit`,
          canDelete: permission.canDelete ?? sql`role_entity_permission.can_delete`,
          deny: permission.deny ?? sql`role_entity_permission.deny`,
          // Restore soft-deleted row — deletePermission() sets isActive=false + deletedAt.
          isActive: true,
          deletedAt: null,
          updatedAt: new Date(),
        },
      });

    return true;
  }

  /**
   * Batched version of getUserEntityPermissions for all stores at once.
   * Resolves N+1 by fetching all role assignments and permissions in 2 queries.
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
          isNull(schema.userRoleMapping.deletedAt),
          eq(schema.userRoleMapping.isActive, true),
          or(isNull(schema.userRoleMapping.expiresAt), gt(schema.userRoleMapping.expiresAt, new Date())),
        ),
      );

    if (storeRoles.length === 0) return {};

    const roleIds = [...new Set(storeRoles.map((r) => r.roleId))];

    const permissions = await this.db
      .select({
        entityCode: entityType.code,
        canView: roleEntityPermission.canView,
        canCreate: roleEntityPermission.canCreate,
        canEdit: roleEntityPermission.canEdit,
        canDelete: roleEntityPermission.canDelete,
        deny: roleEntityPermission.deny,
      })
      .from(roleEntityPermission)
      .innerJoin(
        entityType,
        eq(roleEntityPermission.entityTypeFk, entityType.id),
      )
      .where(
        and(
          inArray(roleEntityPermission.roleFk, roleIds),
          eq(roleEntityPermission.isActive, true),
        ),
      );

    return this.mergeEntityPermissions(permissions);
  }

  /**
   * Get combined permissions for pre-loaded role IDs.
   * Used by PermissionEvaluatorService when roleIds are already on request.user
   * (populated by AuthGuard) — avoids the extra getActiveRolesForStore DB round-trip.
   */
  async getEntityPermissionsForRoleIds(
    roleIds: number[],
  ): Promise<RoleEntityPermissions> {
    if (roleIds.length === 0) return {};

    const permissions = await this.db
      .select({
        entityCode: entityType.code,
        canView: roleEntityPermission.canView,
        canCreate: roleEntityPermission.canCreate,
        canEdit: roleEntityPermission.canEdit,
        canDelete: roleEntityPermission.canDelete,
        deny: roleEntityPermission.deny,
      })
      .from(roleEntityPermission)
      .innerJoin(
        entityType,
        eq(roleEntityPermission.entityTypeFk, entityType.id),
      )
      .where(
        and(
          inArray(roleEntityPermission.roleFk, roleIds),
          eq(roleEntityPermission.isActive, true),
        ),
      );

    return this.mergeEntityPermissions(permissions);
  }

  /**
   * Get combined permissions for user in a specific store.
   * Falls back to querying roles from DB — use only when request.user.roles is unavailable.
   */
  async getUserEntityPermissions(
    userId: number,
    storeId: number,
  ): Promise<RoleEntityPermissions> {
    const storeRoles = await this.rolesRepository.getActiveRolesForStore(userId, storeId);
    return this.getEntityPermissionsForRoleIds(storeRoles.map((r) => r.roleId));
  }

  /**
   * Soft-delete permission.
   * Returns false if entity type not found; the caller is responsible for throwing.
   */
  async deletePermission(roleId: number, entityCode: string): Promise<boolean> {
    const entityTypeId = await this.resolveEntityTypeId(entityCode);
    if (!entityTypeId) {
      return false;
    }

    await this.db
      .update(roleEntityPermission)
      .set({ isActive: false, deletedAt: new Date() })
      .where(
        and(
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.entityTypeFk, entityTypeId),
        ),
      );
    return true;
  }

  /** Find all permissions for a role with entity type codes. */
  async findByRoleId(roleId: number): Promise<
    {
      id: number;
      roleFk: number;
      entityTypeFk: number;
      entityCode: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      deny: boolean;
      isActive: boolean;
      isSystem: boolean;
      createdAt: Date;
      updatedAt: Date | null;
    }[]
  > {
    return this.db
      .select({
        id: roleEntityPermission.id,
        roleFk: roleEntityPermission.roleFk,
        entityTypeFk: roleEntityPermission.entityTypeFk,
        entityCode: entityType.code,
        canView: roleEntityPermission.canView,
        canCreate: roleEntityPermission.canCreate,
        canEdit: roleEntityPermission.canEdit,
        canDelete: roleEntityPermission.canDelete,
        deny: roleEntityPermission.deny,
        isActive: roleEntityPermission.isActive,
        isSystem: roleEntityPermission.isSystem,
        createdAt: roleEntityPermission.createdAt,
        updatedAt: roleEntityPermission.updatedAt,
      })
      .from(roleEntityPermission)
      .innerJoin(
        entityType,
        eq(roleEntityPermission.entityTypeFk, entityType.id),
      )
      .where(
        and(
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.isActive, true),
        ),
      );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /** Resolve entity_type FK by code. Returns null if not found. */
  private async resolveEntityTypeId(
    entityCode: string,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ id: entityType.id })
      .from(entityType)
      .where(eq(entityType.code, entityCode))
      .limit(1);
    return row?.id ?? null;
  }

  /**
   * Merge permissions across multiple roles.
   * Uses union grant (OR) for allow, but DENY overrides all.
   */
  private mergeEntityPermissions(
    permissions: Array<{
      entityCode: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      deny: boolean;
    }>,
  ): RoleEntityPermissions {
    const result: RoleEntityPermissions = {};

    for (const perm of permissions) {
      if (!result[perm.entityCode]) {
        result[perm.entityCode] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          deny: false,
        };
      }

      const entry = result[perm.entityCode];

      // DENY-OVERRIDES-GRANT: once any role denies, suppress all grants so that
      // any caller reading the merged object gets an accurate picture without
      // needing to know to check deny first.
      if (perm.deny) {
        entry.deny = true;
        entry.canView = false;
        entry.canCreate = false;
        entry.canEdit = false;
        entry.canDelete = false;
      } else if (!entry.deny) {
        // Only OR-merge grants when no deny has been applied yet.
        entry.canView = entry.canView || perm.canView;
        entry.canCreate = entry.canCreate || perm.canCreate;
        entry.canEdit = entry.canEdit || perm.canEdit;
        entry.canDelete = entry.canDelete || perm.canDelete;
      }
    }

    return result;
  }
}
