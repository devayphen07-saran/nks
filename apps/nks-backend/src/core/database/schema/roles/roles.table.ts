import { pgTable, varchar, bigint, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { store } from '../store';

export const roles = pgTable(
  'roles',
  {
    ...baseEntity(),

    // No column-level .unique() — uniqueness is enforced per scope via partial indexes below.
    code: varchar('code', { length: 30 }).notNull(),
    roleName: varchar('role_name', { length: 50 }).notNull(),
    description: varchar('description', { length: 250 }),

    // NULL  → system / global role (SUPER_ADMIN, CUSTOMER, STORE_OWNER …)
    // NOT NULL → store-scoped custom role (any store can have a "Cashier")
    storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, {
      onDelete: 'restrict',
    }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // System roles: code must be globally unique when storeFk IS NULL
    uniqueIndex('roles_code_system_idx')
      .on(table.code)
      .where(sql`store_fk IS NULL AND deleted_at IS NULL`),

    // Store roles: code must be unique within each store
    uniqueIndex('roles_code_store_idx')
      .on(table.code, table.storeFk)
      .where(sql`store_fk IS NOT NULL AND deleted_at IS NULL`),

    // Same pair of constraints for roleName
    uniqueIndex('roles_name_system_idx')
      .on(table.roleName)
      .where(sql`store_fk IS NULL AND deleted_at IS NULL`),

    uniqueIndex('roles_name_store_idx')
      .on(table.roleName, table.storeFk)
      .where(sql`store_fk IS NOT NULL AND deleted_at IS NULL`),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type UpdateRole = Partial<Omit<NewRole, 'id'>>;
