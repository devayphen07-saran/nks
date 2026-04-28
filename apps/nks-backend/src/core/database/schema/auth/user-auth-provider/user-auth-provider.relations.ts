import { relations } from 'drizzle-orm';
import { userAuthProvider } from './user-auth-provider.table';
import { users } from '../../auth/users';

// userAuthProvider references users.guuid (text FK — BetterAuth managed).
// Drizzle's relations() works the same regardless of the referenced column type.
export const userAuthProviderRelations = relations(
  userAuthProvider,
  ({ one }) => ({
    user: one(users, {
      fields: [userAuthProvider.userId], // user_fk → users.id
      references: [users.guuid],
    }),
  }),
);
