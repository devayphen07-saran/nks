import { relations } from 'drizzle-orm';
import { auditLogs } from './audit-log.table';
import { users } from '../users';

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userFk],
    references: [users.id],
  }),
}));
