import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Idempotency log for sync push deduplication.
 *
 * The mobile sync engine retries failed uploads automatically. Without this table,
 * a crash between the route mutation and the log write causes
 * re-processing on retry — duplicate inserts or extra version increments.
 *
 * Each sync push operation checks this table first (inside the same
 * transaction as the mutation) to skip already-processed operations.
 *
 * - `request_hash`: SHA-256 of the canonical operation payload. Detects replay
 *   attacks where the same idempotency key is resubmitted with a different payload.
 * - `expires_at`: TTL for automatic cleanup. Indexed for efficient garbage collection.
 *
 * Cleanup: pg_cron deletes entries where expires_at < now().
 */
export const idempotencyLog = pgTable(
  'idempotency_log',
  {
    key: text('key').primaryKey(),
    /** SHA-256 hex digest of the canonical operation payload (op:table:canonicalJson(opData)). */
    requestHash: text('request_hash').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
    /** Entries are eligible for deletion after this timestamp. Default: 7 days from insertion. */
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),
  },
  (t) => [
    index('idempotency_log_processed_idx').on(t.processedAt),
    index('idempotency_log_expires_idx').on(t.expiresAt),
  ],
);

export type IdempotencyLog = typeof idempotencyLog.$inferSelect;
export type NewIdempotencyLog = typeof idempotencyLog.$inferInsert;
