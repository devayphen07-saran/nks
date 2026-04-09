import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Store Category Lookup
 * Defines business categories for stores (Grocery, Pharmacy, Retail, etc.)
 */
export const storeCategory = pgTable('store_category', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type StoreCategory = typeof storeCategory.$inferSelect;
export type NewStoreCategory = typeof storeCategory.$inferInsert;
