import { pgTable, serial, varchar, boolean } from 'drizzle-orm/pg-core';

/**
 * Lookup type definitions
 * Categorizes generic lookup values into logical groups
 *
 * Examples:
 * - PLAN_TYPE (for plan-related lookups)
 * - BILLING_FREQUENCY (for billing-related lookups)
 * - PRODUCT_TYPE (for product-related lookups)
 */
export const lookupType = pgTable('lookup_type', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  title: varchar('title', { length: 50 }).notNull(),
  description: varchar('description', { length: 150 }),
  hasTable: boolean('has_table').default(false),
  isActive: boolean('is_active').default(true),
  isCustomTable: boolean('is_custom_table').default(false),
});

export type LookupType = typeof lookupType.$inferSelect;
export type NewLookupType = typeof lookupType.$inferInsert;
export type UpdateLookupType = Partial<Omit<NewLookupType, 'id'>>;
