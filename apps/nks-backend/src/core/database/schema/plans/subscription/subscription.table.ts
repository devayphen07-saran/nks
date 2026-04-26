import { pgTable, bigint, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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

  // True for the single active subscription row per store.
  // Enforced by a partial unique index — at most one isCurrent=true row per store.
  isCurrent: boolean('is_current').notNull().default(false),

  // Business Fields
  firstInvoiceRecordedAt: timestamp('first_invoice_recorded_at', { withTimezone: true }),
  trialEnd: timestamp('trial_end', { withTimezone: true }),

  // Audit Fields
  ...auditFields(() => users.id),
},
(table) => [
  // At most one current subscription per store.
  uniqueIndex('subscription_current_store_unique_idx')
    .on(table.storeFk)
    .where(sql`is_current = true AND deleted_at IS NULL`),
  index('subscription_plan_fk_idx').on(table.planFk),
  index('subscription_status_fk_idx').on(table.statusFk),
],
);

// Type Exports
export type Subscription = typeof subscription.$inferSelect;
export type NewSubscription = typeof subscription.$inferInsert;
export type UpdateSubscription = Partial<Omit<NewSubscription, 'id'>>;
