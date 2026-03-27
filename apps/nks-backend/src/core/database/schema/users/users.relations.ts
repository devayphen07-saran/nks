import { relations } from 'drizzle-orm';
import { users } from './users.table';
import { userSession } from '../user-session/user-session.table';
import { userAuthProvider } from '../user-auth-provider/user-auth-provider.table';
import { userRoleMapping } from '../user-role-mapping/user-role-mapping.table';
import { storeUserMapping } from '../store-user-mapping/store-user-mapping.table';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSession),
  authProviders: many(userAuthProvider),
  roleAssignments: many(userRoleMapping),
  storeMemberships: many(storeUserMapping),
}));
