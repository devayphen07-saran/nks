import { relations } from 'drizzle-orm';
import { store } from './store.table';
import { codeValue } from '../../lookups/code-value/code-value.table';
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
  storeLegalType: one(codeValue, {
    fields: [store.storeLegalTypeFk],
    references: [codeValue.id],
    relationName: 'storeLegalType',
  }),
  storeCategory: one(codeValue, {
    fields: [store.storeCategoryFk],
    references: [codeValue.id],
    relationName: 'storeCategory',
  }),
  members: many(storeUserMapping),
  operatingHours: many(storeOperatingHours),
  documents: many(storeDocuments),
  subscriptions: many(subscription),
}));
