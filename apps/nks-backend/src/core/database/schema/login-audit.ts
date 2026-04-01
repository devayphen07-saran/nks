import {
  bigint,
  index,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { appendOnlyEntity } from './base.entity';
import { loginStatusEnum } from './enums/enums';

export const loginAudit = pgTable(
  'login_audit',
  {
    ...appendOnlyEntity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loginTimestamp: timestamp('login_timestamp', { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: varchar('user_agent', { length: 500 }),
    status: loginStatusEnum('status').notNull(),
    failureReason: varchar('failure_reason', { length: 255 }),
    deviceId: varchar('device_id', { length: 255 }),
  },
  (table) => [
    // Time-range queries for audit reports
    index('login_audit_created_at_idx').on(table.createdAt),
    // User/status lookups
    index('login_audit_user_idx').on(table.userFk),
    index('login_audit_timestamp_idx').on(table.loginTimestamp),
    // Composite for failed login investigations
    index('login_audit_user_status_idx').on(table.userFk, table.status),
  ],
);

export type LoginAudit = typeof loginAudit.$inferSelect;
export type NewLoginAudit = typeof loginAudit.$inferInsert;
