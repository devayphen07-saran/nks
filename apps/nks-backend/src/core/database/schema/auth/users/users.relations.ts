import { relations } from 'drizzle-orm';
import { users } from './users.table';
import { userSession } from '../../auth/user-session/user-session.table';
import { userAuthProvider } from '../../auth/user-auth-provider/user-auth-provider.table';
import { storeUserMapping } from '../../store/store-user-mapping/store-user-mapping.table';
import { store } from '../../store/store/store.table';

export const usersRelations = relations(users, ({ one, many }) => ({
  defaultStore: one(store, {
    fields: [users.defaultStoreFk],
    references: [store.id],
  }),
  sessions: many(userSession),
  authProviders: many(userAuthProvider),
  storeMemberships: many(storeUserMapping),
}));
