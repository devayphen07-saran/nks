import { relations } from 'drizzle-orm';
import { storeOperatingHours } from './store-operating-hours.table';
import { store } from '../store';
import { users } from '../users';

export const storeOperatingHoursRelations = relations(
  storeOperatingHours,
  ({ one }) => ({
    store: one(store, {
      fields: [storeOperatingHours.storeFk],
      references: [store.id],
    }),
    createdByUser: one(users, {
      fields: [storeOperatingHours.createdBy],
      references: [users.id],
      relationName: 'createdByUser',
    }),
    modifiedByUser: one(users, {
      fields: [storeOperatingHours.modifiedBy],
      references: [users.id],
      relationName: 'modifiedByUser',
    }),
    deletedByUser: one(users, {
      fields: [storeOperatingHours.deletedBy],
      references: [users.id],
      relationName: 'deletedByUser',
    }),
  }),
);
