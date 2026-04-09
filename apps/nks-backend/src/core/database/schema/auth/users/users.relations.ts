import { relations } from 'drizzle-orm';
import { users } from './users.table';
import { userSession } from '../../auth/user-session/user-session.table';
import { userAuthProvider } from '../../auth/user-auth-provider/user-auth-provider.table';
import { storeUserMapping } from '../../store/store-user-mapping/store-user-mapping.table';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSession),
  authProviders: many(userAuthProvider),
  storeMemberships: many(storeUserMapping),
}));
