import { relations } from 'drizzle-orm';
import { planPrice } from './plan-price.table';
import { plans } from '../../plans/plans';
import { currency } from '../../lookups/currency';
import { codeValue } from '../../lookups/code-value/code-value.table';
import { subscriptionItem } from '../../plans/subscription';

export const planPriceRelations = relations(planPrice, ({ one, many }) => ({
  plan: one(plans, {
    fields: [planPrice.planFk],
    references: [plans.id],
  }),
  currencyDetails: one(currency, {
    fields: [planPrice.currencyFk],
    references: [currency.id],
  }),
  frequency: one(codeValue, {
    fields: [planPrice.frequencyFk],
    references: [codeValue.id],
    relationName: 'billingFrequency',
  }),
  subscriptionItems: many(subscriptionItem),
}));
