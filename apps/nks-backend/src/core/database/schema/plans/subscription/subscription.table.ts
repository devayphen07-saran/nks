import { pgTable, bigint, timestamp } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { status } from '../../entity-system/status';
import { plans } from '../../plans/plans';

/**
 * Subscription table - tracks store subscriptions to plans
 *
 * Example statuses: INCOMPLETE, TRIALING, ACTIVE, PAST_DUE, UNPAID, CANCELED
 *
 * Relationships:
 * - One store can have multiple subscriptions
 * - One subscription belongs to one plan with pricing
 * - Subscription can have multiple line items (subscription_item)
 * - Tracks trial periods and invoice dates
 */
export const subscription = pgTable('subscription', {
  ...baseEntity(),

  // Foreign Keys
  storeFk: bigint('store_fk', { mode: 'number' })
    .notNull()
    .references(() => store.id, { onDelete: 'restrict' }),

  planFk: bigint('plan_fk', { mode: 'number' })
    .notNull()
    .references(() => plans.id, { onDelete: 'restrict' }),

  statusFk: bigint('status_fk', { mode: 'number' })
    .notNull()
    .references(() => status.id, { onDelete: 'restrict' }),

  // Business Fields
  firstInvoiceRecordedAt: timestamp('first_invoice_recorded_at', { withTimezone: true }), // ← FIXED: standardized to timestamp
  trialEnd: timestamp('trial_end', { withTimezone: true }), // ← FIXED: standardized to timestamp

  // Audit Fields
  ...auditFields(() => users.id),
});

// Type Exports
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type UpdateSubscription = Partial<Omit<NewSubscription, 'id'>>;
