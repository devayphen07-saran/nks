import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Currency table for billing and pricing
 * Used by: plan_price.currency_fk
 *
 * Examples:
 * - INR (₹), USD ($), EUR (€), GBP (£), AUD (AU$)
 */
export const currency = pgTable('currency', {
  ...baseEntity(),

  // Business Fields
  code: varchar('code', { length: 3 }).notNull().unique(), // ISO 4217 code
  symbol: varchar('symbol', { length: 10 }).notNull(),
  description: varchar('description', { length: 100 }),

  // Audit Fields
  ...auditFields(() => users.id),
});

export type Currency = typeof currency.$inferSelect;
export type NewCurrency = typeof currency.$inferInsert;
export type UpdateCurrency = Partial<Omit<NewCurrency, 'id'>>;
