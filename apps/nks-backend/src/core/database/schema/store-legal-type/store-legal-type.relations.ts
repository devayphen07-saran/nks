import { relations } from 'drizzle-orm';
import { storeLegalType } from './store-legal-type.table';
import { store } from '../store';

export const storeLegalTypeRelations = relations(
  storeLegalType,
  ({ many }) => ({
    stores: many(store),
  }),
);
