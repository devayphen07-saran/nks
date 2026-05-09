import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * lookup — mirrors the backend `lookup` table.
 *
 * Stores reference values grouped by type (salutations, currencies, etc.).
 *
 * Two scopes coexist in this table:
 *   store_id = NULL  → global value, seeded by platform, visible to all stores
 *   store_id = X     → store-scoped custom value, visible only to that store
 *
 * lookup_type_code is stored directly (denormalised) to avoid a join on every
 * read query. The type code never changes for a given lookup value.
 */
export const lookup = sqliteTable(
  'lookup',
  {
    id:               integer('id').primaryKey(),
    guuid:            text('guuid').notNull().unique(),

    // Denormalised type info — avoids join on every read
    lookup_type_id:   integer('lookup_type_id').notNull(),
    lookup_type_code: text('lookup_type_code').notNull(),

    code:             text('code').notNull(),
    label:            text('label').notNull(),
    description:      text('description'),

    // NULL = global; non-null = store-scoped custom value
    store_id:         integer('store_id'),

    is_active:        integer('is_active').notNull().default(1),   // 0 | 1
    is_system:        integer('is_system').notNull().default(0),   // 0 | 1
    is_hidden:        integer('is_hidden').notNull().default(0),   // 0 | 1
    sort_order:       integer('sort_order'),

    version:          integer('version').notNull().default(1),
    updated_at:       text('updated_at').notNull(),
    deleted_at:       text('deleted_at'),
  },
  (t) => [
    // Primary read pattern: all active values for a type
    index('idx_lookup_type_code').on(t.lookup_type_code),

    // Store-scoped filter: type + store
    index('idx_lookup_type_store').on(t.lookup_type_code, t.store_id),

    // Sync cursor ordering (updated_at ASC, id ASC)
    index('idx_lookup_cursor').on(t.updated_at, t.id),
  ],
);

export type LookupRow    = typeof lookup.$inferSelect;
export type InsertLookup = typeof lookup.$inferInsert;
