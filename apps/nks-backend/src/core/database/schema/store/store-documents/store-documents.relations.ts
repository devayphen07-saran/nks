import { relations } from 'drizzle-orm';
import { storeDocuments } from './store-documents.table';
import { store } from '../../store/store';

export const storeDocumentsRelations = relations(storeDocuments, ({ one }) => ({
  store: one(store, {
    fields: [storeDocuments.storeFk],
    references: [store.id],
  }),
}));
