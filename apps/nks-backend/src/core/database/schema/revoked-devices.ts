import {
  pgTable,
  bigint,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth/users';

/**
 * REVOKED_DEVICES
 *
 * Tracks devices whose offline sync access has been explicitly revoked
 * (e.g., a stolen or compromised device was terminated via DELETE /auth/sessions/:id).
 *
 * When a session with a deviceId is terminated, a row is written here.
 * SyncService checks this table on every POST /sync/push that includes an
 * offline session context, rejecting pushes from revoked devices even when
 * their 3-day offline HMAC signature is still cryptographically valid.
 *
 * TTL: entries are cleaned up after OFFLINE_SESSION_TTL_DAYS (3 days) —
 * the same window the offline HMAC is valid for, so old entries cannot
 * match any unexpired signature.
 */
export const revokedDevices = pgTable(
  'revoked_devices',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    deviceId: varchar('device_id', { length: 255 }).notNull(),

    revokedAt: timestamp('revoked_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Who triggered the revocation (null if the user deleted themselves or auto-cleanup)
    revokedBy: bigint('revoked_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    // Lookup: is this (user, device) revoked?
    index('revoked_devices_user_device_idx').on(table.userFk, table.deviceId),
    // Cleanup: delete entries older than 3 days
    index('revoked_devices_revoked_at_idx').on(table.revokedAt),
  ],
);

export type RevokedDevice = typeof revokedDevices.$inferSelect;
export type NewRevokedDevice = typeof revokedDevices.$inferInsert;
