import { relations } from 'drizzle-orm';
import { store } from './store.table';
import { lookup } from '../../lookups/lookup/lookup.table';
import { storeUserMapping } from '../../store/store-user-mapping';
import { storeOperatingHours } from '../../store/store-operating-hours';
import { storeDocuments } from '../../store/store-documents';
import { subscription } from '../../plans/subscription';

export const storeRelations = relations(store, ({ one, many }) => ({
  parent: one(store, {
    fields: [store.parentStoreFk],
    references: [store.id],
    relationName: 'store_hierarchy',
  }),
  children: many(store, {
    relationName: 'store_hierarchy',
  }),
  storeLegalType: one(lookup, {
    fields: [store.storeLegalTypeFk],
    references: [lookup.id],
    relationName: 'storeLegalType',
  }),
  storeCategory: one(lookup, {
    fields: [store.storeCategoryFk],
    references: [lookup.id],
    relationName: 'storeCategory',
  }),
  members: many(storeUserMapping),
  operatingHours: many(storeOperatingHours),
  documents: many(storeDocuments),
  subscriptions: many(subscription),
}));
