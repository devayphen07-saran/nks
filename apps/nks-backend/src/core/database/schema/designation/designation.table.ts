import {
  pgTable,
  varchar,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { store } from '../store';

export const designation = pgTable(
  'designation',
  {
    ...baseEntity(),

    // No column-level .unique() — uniqueness is enforced per scope via partial indexes below.
    designationName: varchar('designation_name', { length: 100 }).notNull(), // e.g. 'CEO', 'Store Manager'
    designationCode: varchar('designation_code', { length: 50 }).notNull(), // e.g. 'CEO', 'STORE_MANAGER'

    // NULL  → system / global designation (CEO, COO …)
    // NOT NULL → store-scoped designation (any store can have a "Store Manager")
    storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, {
      onDelete: 'restrict',
    }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // System designations: code must be globally unique when storeFk IS NULL
    uniqueIndex('designation_code_system_idx')
      .on(table.designationCode)
      .where(sql`store_fk IS NULL AND deleted_at IS NULL`),

    // Store designations: code must be unique within each store
    uniqueIndex('designation_code_store_idx')
      .on(table.designationCode, table.storeFk)
      .where(sql`store_fk IS NOT NULL AND deleted_at IS NULL`),

    // Same pair of constraints for designationName
    uniqueIndex('designation_name_system_idx')
      .on(table.designationName)
      .where(sql`store_fk IS NULL AND deleted_at IS NULL`),

    uniqueIndex('designation_name_store_idx')
      .on(table.designationName, table.storeFk)
      .where(sql`store_fk IS NOT NULL AND deleted_at IS NULL`),

    // FK index — for "list all designations scoped to a store"
    index('designation_store_fk_idx').on(table.storeFk),
  ],
);

export type Designation = typeof designation.$inferSelect;
export type NewDesignation = typeof designation.$inferInsert;
export type UpdateDesignation = Partial<Omit<NewDesignation, 'id'>>;
