import { pgTable, varchar, bigint, integer, boolean, text, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { lookup } from '../../lookups/lookup/lookup.table';

/**
 * Plans table - subscription plan definitions
 *
 * Each plan defines a subscription offer:
 * - Plan type (BASIC, STANDARD, PREMIUM, ENTERPRISE) from lookup
 * - Trial period
 * - Upgrade/downgrade paths
 * - One or more pricing tiers (plan_price table)
 *
 * Relationships:
 * - One plan has many prices (different currencies/frequencies)
 * - One plan can have many subscriptions
 * - Plans reference code_value (PLAN_TYPE category) for plan types
 */
export const plans = pgTable('plans', {
  ...baseEntity(),

  // Business Fields
  code: varchar('code', { length: 60 }).notNull().unique(),
  name: varchar('name', { length: 60 }).notNull(),
  description: text('description'),
  trialDays: integer('trial_days'),
  isEnterprise: boolean('is_enterprise').default(false),
  isDigitalService: boolean('is_digital_service').default(false),
  isMorePopular: boolean('is_more_popular').default(false),

  // Plan type from plan_type lookup table (BASIC, STANDARD, PREMIUM, ENTERPRISE)
  planTypeFk: bigint('plan_type_fk', { mode: 'number' })
    .notNull()
    .references(() => lookup.id, { onDelete: 'restrict' }),

  // Plan path references (allows upgrade/downgrade paths)
  allowToUpgradeFk: bigint('allow_to_upgrade_fk', { mode: 'number' })
    .references((): AnyPgColumn => plans.id, { onDelete: 'set null' }),

  allowToDowngradeFk: bigint('allow_to_downgrade_fk', { mode: 'number' })
    .references((): AnyPgColumn => plans.id, { onDelete: 'set null' }),

  // Audit Fields
  ...auditFields(() => users.id),
}, (table) => [
  // At most one plan can carry the "most popular" badge at a time.
  uniqueIndex('plans_is_more_popular_unique_idx')
    .on(table.isMorePopular)
    .where(sql`is_more_popular = true AND deleted_at IS NULL`),

  index('plans_plan_type_idx').on(table.planTypeFk),
  index('plans_allow_to_upgrade_idx').on(table.allowToUpgradeFk),
  index('plans_allow_to_downgrade_idx').on(table.allowToDowngradeFk),

  // Prevent a plan from referencing itself as an upgrade/downgrade target
  check('plans_no_self_upgrade_chk', sql`allow_to_upgrade_fk IS NULL OR allow_to_upgrade_fk != id`),
  check('plans_no_self_downgrade_chk', sql`allow_to_downgrade_fk IS NULL OR allow_to_downgrade_fk != id`),
]);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type UpdatePlan = Partial<Omit<NewPlan, 'id'>>;
