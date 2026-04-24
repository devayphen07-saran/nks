import { pgTable, bigint, boolean, unique, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { roles } from '../roles';
import { entityType } from '../../lookups/entity-type';
import { permissionAction } from '../permission-action/permission-action.table';
import { coreEntity } from '../../base.entity';

/**
 * Role Permissions — row-per-action permission store.
 *
 * One row per (role, entity, action) triple instead of one wide row with
 * fixed boolean columns. Adding a new action (EXPORT, APPROVE, …) requires
 * only an INSERT into permission_action — no ALTER TABLE here.
 *
 * Deny semantics:
 *   - Any role with deny = true for an entity → hard block; all grants for
 *     that entity are suppressed regardless of other roles.
 *   - Otherwise: OR across all rows for the same (entity, action) pair;
 *     any allowed = true wins.
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

    actionFk: bigint('action_fk', { mode: 'number' })
      .notNull()
      .references(() => permissionAction.id, { onDelete: 'restrict' }),

    allowed: boolean('allowed').notNull().default(false),
    deny: boolean('deny').notNull().default(false),
  },
  (table) => [
    unique('role_permissions_unique_idx').on(
      table.roleFk,
      table.entityTypeFk,
      table.actionFk,
    ),
    // Primary hot path: fetch all permissions for a set of role IDs.
    index('role_permissions_role_idx')
      .on(table.roleFk)
      .where(sql`is_active = true AND deleted_at IS NULL`),
    // Admin UI: per-entity permission matrix for a role.
    index('role_permissions_role_entity_idx')
      .on(table.roleFk, table.entityTypeFk)
      .where(sql`is_active = true AND deleted_at IS NULL`),
  ],
);

export type RolePermissionRow = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
