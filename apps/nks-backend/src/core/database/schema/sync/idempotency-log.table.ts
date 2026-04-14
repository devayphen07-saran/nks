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
 * Cleanup: pg_cron deletes entries older than 7 days.
 */
export const idempotencyLog = pgTable(
  'idempotency_log',
  {
    key: text('key').primaryKey(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW()`),
  },
  (t) => [index('idempotency_log_processed_idx').on(t.processedAt)],
);

export type IdempotencyLog = typeof idempotencyLog.$inferSelect;
export type NewIdempotencyLog = typeof idempotencyLog.$inferInsert;
