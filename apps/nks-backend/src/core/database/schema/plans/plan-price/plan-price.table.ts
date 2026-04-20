import { pgTable, varchar, bigint, integer, boolean, numeric, index } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { plans } from '../../plans/plans';
import { currency } from '../../lookups/currency';
import { billingFrequency } from '../../lookups/billing-frequency/billing-frequency.table';

/**
 * Plan Price table - pricing tiers for plans
 *
 * One plan can have multiple prices:
 * - Different currencies (INR, USD, EUR, etc.)
 * - Different billing frequencies (monthly, annual, etc.)
 *
 * Example: "Premium Plan - USD Monthly - $99.99"
 *
 * Relationships:
 * - Many prices belong to one plan
 * - Each price uses one currency
 * - Each price has one frequency (from lookup table)
 * - Subscription items reference specific prices
 */
export const planPrice = pgTable('plan_price', {
  ...baseEntity(),

  // Pricing Details
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  billingCycle: varchar('billing_cycle', { length: 60 }),
  intervalCount: integer('interval_count'),
  isTaxInclusive: boolean('is_tax_inclusive').default(false),

  // Foreign Keys
  planFk: bigint('plan_fk', { mode: 'number' })
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),

  currencyFk: bigint('currency_fk', { mode: 'number' })
    .notNull()
    .references(() => currency.id, { onDelete: 'restrict' }),

  // Billing frequency (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, ONE_TIME)
  // NORMALIZED: Dedicated table instead of code_value pattern
  frequencyFk: bigint('frequency_fk', { mode: 'number' })
    .notNull()
    .references(() => billingFrequency.id, { onDelete: 'restrict' }),

  // Audit Fields
  ...auditFields(() => users.id),
},
(table) => [
  index('plan_price_plan_fk_idx').on(table.planFk),
  index('plan_price_currency_fk_idx').on(table.currencyFk),
  index('plan_price_frequency_fk_idx').on(table.frequencyFk),
],
);

export type PlanPrice = typeof planPrice.$inferSelect;
export type NewPlanPrice = typeof planPrice.$inferInsert;
export type UpdatePlanPrice = Partial<Omit<NewPlanPrice, 'id'>>;
