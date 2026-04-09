import { pgTable, varchar, text, integer } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Billing Frequency Lookup
 * Subscription billing frequencies (Monthly, Quarterly, Semi-Annual, Annual, One-Time)
 */
export const billingFrequency = pgTable('billing_frequency', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  days: integer('days').notNull(), // 30, 90, 180, 365, 0 (one-time)
  ...auditFields(() => users.id),
});

export type BillingFrequency = typeof billingFrequency.$inferSelect;
export type NewBillingFrequency = typeof billingFrequency.$inferInsert;
