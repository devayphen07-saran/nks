import { pgTable, varchar, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Permission Action — extensible action registry.
 *
 * System actions (VIEW, CREATE, EDIT, DELETE) are seeded by migration 032 and
 * marked isSystem = true — they cannot be removed via the admin UI.
 *
 * New actions (EXPORT, APPROVE, ARCHIVE, PUBLISH, …) require only an INSERT
 * into this table, no schema migration. The old role_entity_permission columns
 * (can_view, can_create, …) are replaced by rows in role_permissions that
 * reference this table via action_fk.
 *
 * Code convention: SCREAMING_SNAKE_CASE ('VIEW', 'CREATE', 'EXPORT', …).
 * Callers use the lowercase PermissionActions constants from
 * entity-codes.constants.ts ('view', 'create', …); the evaluator uppercases
 * at lookup time so decorator call-sites never need to change.
 */
export const permissionAction = pgTable(
  'permission_action',
  {
    ...baseEntity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    description: text('description'),
    ...auditFields(() => users.id),
  },
  (table) => [
    index('permission_action_active_idx')
      .on(table.isActive)
      .where(sql`is_active = true AND deleted_at IS NULL`),
  ],
);

export type PermissionActionRow = typeof permissionAction.$inferSelect;
export type NewPermissionAction = typeof permissionAction.$inferInsert;
