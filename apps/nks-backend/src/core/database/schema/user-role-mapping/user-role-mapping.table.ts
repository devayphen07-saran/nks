import { pgTable, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { junctionEntity } from '../base.entity';
import { users } from '../users';
import { roles } from '../roles';
import { store } from '../store';

export const userRoleMapping = pgTable(
  'user_role_mapping',
  {
    ...junctionEntity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, {
      onDelete: 'restrict',
    }),

    // Who assigned — the single audit field needed; no auditFields() bloat.
    assignedBy: bigint('assigned_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    // Global roles (storeFk IS NULL): PostgreSQL NULL != NULL in UNIQUE constraints,
    // so a plain unique(userFk, roleFk, storeFk) would allow duplicate global-role rows.
    // Partial index covers the NULL case explicitly.
    uniqueIndex('user_role_mapping_global_idx')
      .on(table.userFk, table.roleFk)
      .where(sql`store_fk IS NULL`),

    // Store-scoped roles: same (user, role) pair is allowed in different stores.
    uniqueIndex('user_role_mapping_store_idx')
      .on(table.userFk, table.roleFk, table.storeFk)
      .where(sql`store_fk IS NOT NULL`),

    // Reverse lookup: "which users have role X?"
    index('user_role_mapping_role_idx').on(table.roleFk),
    // assigned_by index for auditing
    index('user_role_mapping_assigned_by_idx').on(table.assignedBy),
  ],
);

export type UserRoleMapping = typeof userRoleMapping.$inferSelect;
export type NewUserRoleMapping = typeof userRoleMapping.$inferInsert;
