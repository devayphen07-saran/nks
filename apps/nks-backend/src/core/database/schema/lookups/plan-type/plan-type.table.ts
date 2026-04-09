import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Plan Type Lookup
 * Plan classification (Starter, Professional, Enterprise, Premium, Standard, Trial)
 */
export const planType = pgTable('plan_type', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  ...auditFields(() => users.id),
});

export type PlanType = typeof planType.$inferSelect;
export type NewPlanType = typeof planType.$inferInsert;
