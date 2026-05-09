import { relations } from 'drizzle-orm';
import { deviceRegistration } from './device-registration.table';
import { users } from '../auth/users';
import { store } from '../store/store';

export const deviceRegistrationRelations = relations(
  deviceRegistration,
  ({ one }) => ({
    user: one(users, {
      fields: [deviceRegistration.userId],
      references: [users.id],
    }),
    store: one(store, {
      fields: [deviceRegistration.storeId],
      references: [store.id],
    }),
  }),
);
