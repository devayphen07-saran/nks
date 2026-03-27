import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';

// Functional store classification for POS routing, UI display, and analytics.
// Distinct from store_legal_type (which is KYC/legal entity structure).
// Seeded values: GROCERY, PHARMACY, RESTAURANT, ELECTRONICS, CLOTHING, GENERAL
export const storeCategory = pgTable('store_category', {
  ...baseEntity(),

  categoryName: varchar('category_name', { length: 50 }).notNull().unique(), // e.g. 'Grocery'
  categoryCode: varchar('category_code', { length: 30 }).notNull().unique(), // e.g. 'GROCERY'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type StoreCategory = typeof storeCategory.$inferSelect;
export type NewStoreCategory = typeof storeCategory.$inferInsert;
export type UpdateStoreCategory = Partial<Omit<NewStoreCategory, 'id'>>;
