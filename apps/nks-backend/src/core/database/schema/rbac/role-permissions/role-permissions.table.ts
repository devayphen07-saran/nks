import { pgTable, bigint, boolean, check, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { roles } from '../roles';
import { entityType } from '../../lookups/entity-type';
import { coreEntity } from '../../base.entity';

/**
 * Role Permissions — one wide row per (role, entity).
 *
 * Boolean columns mirror ayphen's role_permission_mapping pattern:
 *   allow      — master access grant for the entity
 *   can_view   — read permission
 *   can_create — create permission
 *   can_edit   — update permission
 *   can_delete — delete permission
 *
 * Deny semantics:
 *   deny = true → hard block; all grants for that entity are suppressed
 *   regardless of other roles. deny overrides allow.
 *
 * Merge rule across multiple roles: OR for grants (any role granting = granted),
 * OR for deny (any role denying = denied — deny overrides).
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

    allow:     boolean('allow').notNull().default(false),
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
    check('role_permissions_no_allow_deny_conflict', sql`NOT (allow = true AND deny = true)`),
  ],
);

export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermission  = typeof rolePermissions.$inferInsert;
