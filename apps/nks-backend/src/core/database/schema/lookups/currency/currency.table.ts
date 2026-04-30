import { pgTable, varchar } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Currency table for billing and pricing
 * Used by: plan_price.currency_fk
 *
 * Examples:
 * - INR (₹), USD ($), EUR (€), GBP (£), AUD (AU$)
 *
 * ⚠ DO NOT CONSOLIDATE INTO `lookup` TABLE.
 * Reason: `symbol` is essential for UI rendering (₹, $, €, £) and cannot be
 *   represented in the generic (code, label, description) shape of `lookup`.
 * Registered in `lookup_type` with has_table=true for catalog discoverability.
 * Confirmed against Ayphen reference codebase (2026-04-30): Currency is also
 *   kept dedicated there for the same reason.
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
