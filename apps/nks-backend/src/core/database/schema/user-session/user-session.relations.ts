import { relations } from 'drizzle-orm';
import { userSession } from './user-session.table';
import { users } from '../users';

// userSession references users.id (bigint FK).
export const userSessionRelations = relations(userSession, ({ one }) => ({
  user: one(users, {
    fields: [userSession.userId], // user_fk → users.id
    references: [users.id],
  }),
}));
