import { pgTable, uuid, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * JTI Blocklist — Revoked JWT Access Token Registry
 *
 * When a session is terminated (logout, force-revoke, password change),
 * the corresponding JWT's jti claim is written here with an expiry equal
 * to the JWT's own TTL (15 minutes). AuthGuard checks this table after
 * finding a valid session, preventing the short revocation window where
 * the JWT is cryptographically valid but the session intent is revoked.
 *
 * Rows are expired automatically — the guard skips rows where expires_at
 * is in the past, and a daily cron deletes them.
 *
 * Created by migration 023_jti_blocklist.sql
 */
export const jtiBlocklist = pgTable(
  'jti_blocklist',
  {
    jti: uuid('jti').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('jti_blocklist_expires_idx').on(table.expiresAt),
  ],
);

export type JtiBlocklistEntry = typeof jtiBlocklist.$inferSelect;
