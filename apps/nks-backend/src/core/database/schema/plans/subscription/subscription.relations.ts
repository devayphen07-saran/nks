import { relations } from 'drizzle-orm';
import { subscription } from './subscription.table';
import { subscriptionItem } from './subscription-item.table';
import { store } from '../../store/store';
import { status } from '../../entity-system/status';
import { plans } from '../../plans/plans';

export const subscriptionRelations = relations(subscription, ({ many, one }) => ({
  items: many(subscriptionItem),
  store: one(store, {
    fields: [subscription.storeFk],
    references: [store.id],
  }),
  plan: one(plans, {
    fields: [subscription.planFk],
    references: [plans.id],
  }),
  status: one(status, {
    fields: [subscription.statusFk],
    references: [status.id],
  }),
}));
