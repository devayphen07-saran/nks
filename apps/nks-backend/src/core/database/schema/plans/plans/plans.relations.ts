import { relations } from 'drizzle-orm';
import { plans } from './plans.table';
import { lookup } from '../../lookups/lookup/lookup.table';
import { planPrice } from '../../plans/plan-price';
import { subscription } from '../../plans/subscription';

export const plansRelations = relations(plans, ({ one, many }) => ({
  planType: one(lookup, {
    fields: [plans.planTypeFk],
    references: [lookup.id],
    relationName: 'planType',
  }),
  upgradeOption: one(plans, {
    fields: [plans.allowToUpgradeFk],
    references: [plans.id],
    relationName: 'upgrade_path',
  }),
  downgradeOption: one(plans, {
    fields: [plans.allowToDowngradeFk],
    references: [plans.id],
    relationName: 'downgrade_path',
  }),
  prices: many(planPrice),
  subscriptions: many(subscription),
}));
