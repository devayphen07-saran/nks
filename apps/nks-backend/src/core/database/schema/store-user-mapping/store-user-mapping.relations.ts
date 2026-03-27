import { relations } from 'drizzle-orm';
import { storeUserMapping } from './store-user-mapping.table';
import { store } from '../store';
import { users } from '../users';
import { designation } from '../designation';

export const storeUserMappingRelations = relations(
  storeUserMapping,
  ({ one }) => ({
    store: one(store, {
      fields: [storeUserMapping.storeFk],
      references: [store.id],
    }),
    user: one(users, {
      fields: [storeUserMapping.userFk],
      references: [users.id],
    }),
    designation: one(designation, {
      fields: [storeUserMapping.designationFk],
      references: [designation.id],
    }),
  }),
);
