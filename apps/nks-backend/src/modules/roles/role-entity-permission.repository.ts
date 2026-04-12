import { Injectable } from '@nestjs/common';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { entityType } from '../../core/database/schema/lookups/entity-type/entity-type.table';
import { roleEntityPermission } from '../../core/database/schema/rbac/role-entity-permission/role-entity-permission.table';
import { eq, and, inArray } from 'drizzle-orm';
import { RolesRepository } from './roles.repository';
import type {
  EntityPermission,
  RoleEntityPermissions,
} from './dto/role-response.dto';

type RoleEntityPermissionRow = typeof roleEntityPermission.$inferSelect;

@Injectable()
export class RoleEntityPermissionRepository {
  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly rolesRepository: RolesRepository,
  ) {}

  /**
   * Get all entity permissions for a role.
   * Joins with entity_type to get entity codes from the lookup table.
   */
  async getPermissionsByRole(roleId: number): Promise<RoleEntityPermissions> {
    const mappings = await this.db
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
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.isActive, true),
        ),
      );

    const result: RoleEntityPermissions = {};
    mappings.forEach((mapping) => {
      result[mapping.entityCode] = {
        canView: mapping.canView,
        canCreate: mapping.canCreate,
        canEdit: mapping.canEdit,
        canDelete: mapping.canDelete,
        deny: mapping.deny,
      };
    });

    return result;
  }

  /**
   * Get permission for specific role and entity.
   * Accepts entityCode string and looks up entity_type to find FK.
   */
  async getPermission(
    roleId: number,
    entityCode: string,
  ): Promise<EntityPermission | null> {
    const entityTypeId = await this.resolveEntityTypeId(entityCode);
    if (!entityTypeId) return null;

    const [mapping] = await this.db
      .select()
      .from(roleEntityPermission)
      .where(
        and(
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.entityTypeFk, entityTypeId),
          eq(roleEntityPermission.isActive, true),
        ),
      )
      .limit(1);

    if (!mapping) return null;

    return {
      canView: mapping.canView,
      canCreate: mapping.canCreate,
      canEdit: mapping.canEdit,
      canDelete: mapping.canDelete,
      deny: mapping.deny,
    };
  }

  /**
   * Check if role has specific permission on entity.
   */
  async checkPermission(
    roleId: number,
    entityCode: string,
    action: 'view' | 'create' | 'edit' | 'delete',
  ): Promise<boolean> {
    const permission = await this.getPermission(roleId, entityCode);
    if (!permission) return false;

    switch (action) {
      case 'view':
        return permission.canView;
      case 'create':
        return permission.canCreate;
      case 'edit':
        return permission.canEdit;
      case 'delete':
        return permission.canDelete;
      default:
        return false;
    }
  }

  /**
   * Create or update entity permission for a role.
   * Accepts entityCode string and looks up entity_type to find FK.
   * Returns false if entity type not found; caller should decide how to handle.
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

    const [existing] = await this.db
      .select()
      .from(roleEntityPermission)
      .where(
        and(
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.entityTypeFk, entityTypeId),
        ),
      )
      .limit(1);

    if (existing) {
      await this.db
        .update(roleEntityPermission)
        .set({
          canView: permission.canView ?? existing.canView,
          canCreate: permission.canCreate ?? existing.canCreate,
          canEdit: permission.canEdit ?? existing.canEdit,
          canDelete: permission.canDelete ?? existing.canDelete,
          deny: permission.deny ?? existing.deny,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(roleEntityPermission.roleFk, roleId),
            eq(roleEntityPermission.entityTypeFk, entityTypeId),
          ),
        );
    } else {
      await this.db.insert(roleEntityPermission).values({
        roleFk: roleId,
        entityTypeFk: entityTypeId,
        canView: permission.canView ?? false,
        canCreate: permission.canCreate ?? false,
        canEdit: permission.canEdit ?? false,
        canDelete: permission.canDelete ?? false,
        deny: permission.deny ?? false,
        isActive: true,
        isSystem: false,
      });
    }
    return true;
  }

  /**
   * Get combined permissions for user in a specific store.
   * Returns entity permissions merged across all roles (union grant, but DENY overrides).
   */
  async getUserEntityPermissions(
    userId: number,
    storeId: number,
  ): Promise<RoleEntityPermissions> {
    const storeRoles = await this.rolesRepository.getActiveRolesForStore(
      userId,
      storeId,
    );

    if (storeRoles.length === 0) return {};

    const roleIds = storeRoles.map((r) => r.roleId);

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
   * Soft-delete permission.
   * Returns false if entity type not found; caller should decide how to handle.
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
  async findByRoleId(roleId: number): Promise<{
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
  }[]> {
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

  /**
   * Create a new entity permission using entity code (looks up FK).
   * Returns null if entity type not found; caller should decide how to handle.
   */
  async create(
    roleId: number,
    entityCode: string,
    data: Partial<EntityPermission>,
  ): Promise<RoleEntityPermissionRow | null> {
    const entityTypeId = await this.resolveEntityTypeId(entityCode);
    if (!entityTypeId) {
      return null;
    }

    const [created] = await this.db
      .insert(roleEntityPermission)
      .values({
        roleFk: roleId,
        entityTypeFk: entityTypeId,
        canView: data.canView ?? false,
        canCreate: data.canCreate ?? false,
        canEdit: data.canEdit ?? false,
        canDelete: data.canDelete ?? false,
        deny: data.deny ?? false,
        isActive: true,
        isSystem: false,
      })
      .returning();
    return created ?? null;
  }

  /** Delete by role and entity code (hard delete for cleanup). */
  async deleteByRoleAndEntity(roleId: number, entityCode: string): Promise<void> {
    const entityTypeId = await this.resolveEntityTypeId(entityCode);
    if (!entityTypeId) return;

    await this.db
      .delete(roleEntityPermission)
      .where(
        and(
          eq(roleEntityPermission.roleFk, roleId),
          eq(roleEntityPermission.entityTypeFk, entityTypeId),
        ),
      );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /** Resolve entity_type FK by code. Returns null if not found. */
  private async resolveEntityTypeId(entityCode: string): Promise<number | null> {
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
    permissions.forEach((perm) => {
      if (!result[perm.entityCode]) {
        result[perm.entityCode] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
          deny: false,
        };
      }
      result[perm.entityCode].canView =
        result[perm.entityCode].canView || perm.canView;
      result[perm.entityCode].canCreate =
        result[perm.entityCode].canCreate || perm.canCreate;
      result[perm.entityCode].canEdit =
        result[perm.entityCode].canEdit || perm.canEdit;
      result[perm.entityCode].canDelete =
        result[perm.entityCode].canDelete || perm.canDelete;
      result[perm.entityCode].deny =
        result[perm.entityCode].deny || perm.deny;
    });

    return result;
  }
}
