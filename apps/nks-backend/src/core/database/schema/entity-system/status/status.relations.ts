import { relations } from 'drizzle-orm';
import { status } from './status.table';
import { subscription } from '../../plans/subscription';

export const statusRelations = relations(status, ({ many }) => ({
  subscriptions: many(subscription),
}));
