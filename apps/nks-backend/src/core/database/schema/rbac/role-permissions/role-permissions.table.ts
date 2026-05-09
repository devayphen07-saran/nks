import { pgTable, bigint, boolean, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { roles } from '../roles';
import { entityType } from '../../lookups/entity-type';
import { coreEntity } from '../../base.entity';

/**
 * Role Permissions — one wide row per (role, entity).
 *
 * Boolean columns:
 *   can_view   — read permission
 *   can_create — create permission
 *   can_edit   — update permission
 *   can_delete — delete permission
 *
 * Deny semantics:
 *   deny = true → hard block; all grants for that entity are suppressed
 *   regardless of other roles. deny is set-membership absolute, not a weight.
 *
 * Merge rule across multiple roles: OR for grants (any role granting = granted),
 * OR for deny (any role denying = denied — deny overrides every grant).
 *
 * NOTE: a previous `allow` column was dropped in migration 0016 — it was
 * derived as `!deny` on write and never read. Do not reintroduce it; if a
 * "master grant" semantic is ever needed, add it explicitly to the merge
 * logic in PermissionsRepository.mergePermissions.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    ...coreEntity(),

    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    entityTypeFk: bigint('entity_type_fk', { mode: 'number' })
      .notNull()
      .references(() => entityType.id, { onDelete: 'restrict' }),

    canView:   boolean('can_view').notNull().default(false),
    canCreate: boolean('can_create').notNull().default(false),
    canEdit:   boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    deny:      boolean('deny').notNull().default(false),
  },
  (table) => [
    unique('role_permissions_unique_idx').on(table.roleFk, table.entityTypeFk),
    index('role_permissions_role_idx')
      .on(table.roleFk)
      .where(sql`is_active = true AND deleted_at IS NULL`),
    index('role_permissions_role_entity_idx')
      .on(table.roleFk, table.entityTypeFk)
      .where(sql`is_active = true AND deleted_at IS NULL`),
  ],
);

export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermission  = typeof rolePermissions.$inferInsert;
