import { relations } from 'drizzle-orm';
import { store } from './store.table';
import { storeLegalType } from '../store-legal-type';
import { storeCategory } from '../store-category';
import { storeUserMapping } from '../store-user-mapping';

export const storeRelations = relations(store, ({ one, many }) => ({
  parent: one(store, {
    fields: [store.parentStoreFk],
    references: [store.id],
    relationName: 'store_hierarchy',
  }),
  children: many(store, {
    relationName: 'store_hierarchy',
  }),
  storeLegalType: one(storeLegalType, {
    fields: [store.storeLegalTypeFk],
    references: [storeLegalType.id],
  }),
  storeCategory: one(storeCategory, {
    fields: [store.storeCategoryFk],
    references: [storeCategory.id],
  }),
  members: many(storeUserMapping),
}));
