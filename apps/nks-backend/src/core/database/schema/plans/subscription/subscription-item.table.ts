import { pgTable, bigint, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { subscription } from './subscription.table';
import { planPrice } from '../../plans/plan-price';

/**
 * Subscription Item table - line items within a subscription
 *
 * Each subscription can have multiple items (e.g., base plan + add-ons)
 * Items track:
 * - Which pricing tier is being used (plan_price_fk)
 * - Billing mode (recurring or one-time)
 * - Active period (effective_from to effective_to)
 *
 * Use cases:
 * - Base plan item (RECURRING)
 * - Add-on items (can be RECURRING or ONE_TIME)
 * - Plan upgrades/downgrades (effective date tracking)
 *
 * NOTE: planPriceFk reference is pending implementation of plan_price table.
 */
export const subscriptionItem = pgTable('subscription_item', {
  ...baseEntity(),

  // Foreign Keys
  subscriptionFk: bigint('subscription_fk', { mode: 'number' })
    .notNull()
    .references(() => subscription.id, { onDelete: 'cascade' }),

  planPriceFk: bigint('plan_price_fk', { mode: 'number' })
    .references(() => planPrice.id, { onDelete: 'set null' }),

  // Business Fields
  priceMode: varchar('price_mode', { length: 30 }).notNull().default('RECURRING'), // RECURRING | ONE_TIME
  effectiveFrom: timestamp('effective_from', { withTimezone: true }), // ← FIXED: standardized to timestamp
  effectiveTo: timestamp('effective_to', { withTimezone: true }), // ← FIXED: standardized to timestamp

  // Audit Fields
  ...auditFields(() => users.id),
}, (table) => [
  index('subscription_item_subscription_idx').on(table.subscriptionFk),
  index('subscription_item_plan_price_idx').on(table.planPriceFk),
]);

// Type Exports
export type SubscriptionItem = typeof subscriptionItem.$inferSelect;
export type NewSubscriptionItem = typeof subscriptionItem.$inferInsert;
export type UpdateSubscriptionItem = Partial<Omit<NewSubscriptionItem, 'id'>>;
