import { pgTable, varchar, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { lookupType } from '../lookup-type/lookup-type.table';

/**
 * lookup — generic reference values, grouped by lookup_type.
 *
 * Global values  → store_fk = NULL  (available to all stores, seeded by platform)
 * Store values   → store_fk = X     (custom values added by a specific store)
 *
 * is_system = true  → seeded by the platform; cannot be edited or deleted via API
 * is_system = false → created at runtime by admin or store owner; fully manageable
 *
 * Uniqueness: code is unique within (lookup_type_fk, store_fk) — allows the same
 * short code (e.g. 'MONTHLY') in different types without global namespace collisions.
 */
export const lookup = pgTable(
  'lookup',
  {
    ...baseEntity(),

    lookupTypeFk: bigint('lookup_type_fk', { mode: 'number' })
      .notNull()
      .references(() => lookupType.id, { onDelete: 'restrict' }),

    code:        varchar('code',        { length: 50  }).notNull(),
    label:       varchar('label',       { length: 150 }).notNull(),
    description: varchar('description', { length: 255 }),

    // NULL = global value; non-null = store-scoped custom value
    storeFk: bigint('store_fk', { mode: 'number' }).references(
      (): AnyPgColumn => store.id,
      { onDelete: 'cascade' },
    ),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Global values: code unique within type
    uniqueIndex('lookup_code_type_global_idx')
      .on(table.code, table.lookupTypeFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NULL`),

    // Store values: code unique within type + store
    uniqueIndex('lookup_code_type_store_idx')
      .on(table.code, table.lookupTypeFk, table.storeFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NOT NULL`),

    index('lookup_type_fk_idx').on(table.lookupTypeFk),
    index('lookup_store_fk_idx').on(table.storeFk),
  ],
);

export type Lookup    = typeof lookup.$inferSelect;
export type NewLookup = typeof lookup.$inferInsert;
export type UpdateLookup = Partial<Omit<NewLookup, 'id'>>;
