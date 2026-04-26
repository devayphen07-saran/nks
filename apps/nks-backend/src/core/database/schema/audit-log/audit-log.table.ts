import {
  pgTable,
  varchar,
  boolean,
  text,
  jsonb,
  inet,
  bigint,
  uuid,
  index,
} from 'drizzle-orm/pg-core';
import { auditActionTypeEnum, sessionDeviceTypeEnum } from '../enums/enums';
import { users } from '../auth/users';
import { store } from '../store/store';
import { userSession } from '../auth/user-session';
import { appendOnlyEntity } from '../base.entity';

export const auditLogs = pgTable(
  'audit_logs',
  {
    // appendOnlyEntity — rows are immutable; no soft-delete, no update timestamps, no UI flags.
    ...appendOnlyEntity(),
    // guuid — public stable identifier for external lookup without exposing sequential numeric id.
    guuid: uuid('guuid')
      .notNull()
      .unique()
      .$defaultFn(() => crypto.randomUUID()),

    userFk: bigint('user_fk', { mode: 'number' }).references(() => users.id, {
      onDelete: 'set null',
    }),
    // storeFk — filter audit history by store; NULL for user-level or system actions.
    storeFk: bigint('store_fk', { mode: 'number' }).references(() => store.id, {
      onDelete: 'set null',
    }),
    // sessionFk — link action back to the session that caused it; NULL for background jobs.
    sessionFk: bigint('session_fk', { mode: 'number' }).references(
      () => userSession.id,
      {
        onDelete: 'set null',
      },
    ),

    phoneNumber: varchar('phone_number', { length: 20 }),
    action: auditActionTypeEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 50 }),
    entityId: bigint('entity_id', { mode: 'number' }),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    meta: jsonb('meta'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    deviceId: varchar('device_id', { length: 100 }),
    deviceType: sessionDeviceTypeEnum('device_type'),
    isSuccess: boolean('is_success').notNull().default(true),
    failureReason: text('failure_reason'),
  },
  (table) => [
    // Time-range queries (e.g., SELECT * WHERE created_at > ?)
    index('audit_logs_created_at_idx').on(table.createdAt),
    // User/store/action lookups
    index('audit_logs_user_idx').on(table.userFk),
    index('audit_logs_store_idx').on(table.storeFk),
    index('audit_logs_action_idx').on(table.action),
    // Composite for common audit lookups
    index('audit_logs_store_action_idx').on(table.storeFk, table.action),
    // User activity timeline: WHERE user_fk = ? ORDER BY created_at DESC
    index('audit_logs_user_created_at_idx').on(table.userFk, table.createdAt),
  ],
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
