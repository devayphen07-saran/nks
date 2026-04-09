import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Generic lookup table for system-wide reference values
 * Used for: plan types, billing frequencies, product types, etc.
 *
 * Examples:
 * - PLAN_TYPE_BASIC, PLAN_TYPE_STANDARD, PLAN_TYPE_PREMIUM, PLAN_TYPE_ENTERPRISE
 * - FREQUENCY_MONTHLY, FREQUENCY_ANNUAL, FREQUENCY_ONE_TIME
 * - PRODUCT_TYPE_SAAS, PRODUCT_TYPE_SERVICE
 */
export const lookup = pgTable('lookup', {
  ...baseEntity(),

  // Business Fields
  code: varchar('code', { length: 30 }).notNull().unique(),
  title: varchar('title', { length: 50 }).notNull(),
  description: varchar('description', { length: 100 }),

  // Audit Fields
  ...auditFields(() => users.id),
});

export type Lookup = typeof lookup.$inferSelect;
export type NewLookup = typeof lookup.$inferInsert;
export type UpdateLookup = Partial<Omit<NewLookup, 'id'>>;
