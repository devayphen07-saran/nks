import { pgTable, varchar, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { codeCategory } from '../../lookups/code-category/code-category.table';

/**
 * Master value table — stores the actual values under each category.
 *
 * Global values  → store_fk = NULL  (available to all stores)
 * Store values   → store_fk = X     (custom values added by a specific store)
 *
 * is_system = true  → seeded by the platform, cannot be edited or deleted via API
 * is_system = false → created by platform admin or store owner, fully manageable
 */
export const codeValue = pgTable(
  'code_value',
  {
    ...baseEntity(),

    categoryFk: bigint('category_fk', { mode: 'number' })
      .notNull()
      .references(() => codeCategory.id, { onDelete: 'restrict' }),

    code:        varchar('code',        { length: 50  }).notNull(),
    label:       varchar('label',       { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }),

    // NULL = global value; set = store-scoped custom value
    storeFk: bigint('store_fk', { mode: 'number' }).references(
      () => store.id,
      { onDelete: 'cascade' },
    ),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Global values: code must be unique within a category
    uniqueIndex('code_value_code_category_global_idx')
      .on(table.code, table.categoryFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NULL`),

    // Store values: code must be unique within a category + store
    uniqueIndex('code_value_code_category_store_idx')
      .on(table.code, table.categoryFk, table.storeFk)
      .where(sql`deleted_at IS NULL AND store_fk IS NOT NULL`),

    index('code_value_category_idx').on(table.categoryFk),
    index('code_value_store_idx').on(table.storeFk),
  ],
);

export type CodeValue    = typeof codeValue.$inferSelect;
export type NewCodeValue = typeof codeValue.$inferInsert;
