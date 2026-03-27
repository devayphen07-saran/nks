import { relations } from 'drizzle-orm';
import { userSession } from './user-session.table';
import { users } from '../users';

// userSession references users.guuid (text FK — BetterAuth managed).
export const userSessionRelations = relations(userSession, ({ one }) => ({
  user: one(users, {
    fields: [userSession.userId], // user_fk → users.guuid
    references: [users.guuid],
  }),
}));
