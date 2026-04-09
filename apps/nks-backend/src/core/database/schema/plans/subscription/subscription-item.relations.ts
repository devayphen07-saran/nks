import { relations } from 'drizzle-orm';
import { subscriptionItem } from './subscription-item.table';
import { subscription } from './subscription.table';
import { planPrice } from '../../plans/plan-price';

export const subscriptionItemRelations = relations(subscriptionItem, ({ one }) => ({
  subscription: one(subscription, {
    fields: [subscriptionItem.subscriptionFk],
    references: [subscription.id],
  }),
  planPrice: one(planPrice, {
    fields: [subscriptionItem.planPriceFk],
    references: [planPrice.id],
  }),
}));
