import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';

// Database-backed rate limiting. One row per unique key (IP address).
// Survives restarts and is shared across all replica instances.
export const rateLimitEntries = pgTable(
  'rate_limit_entries',
  {
    key: text('key').primaryKey(),
    hits: integer('hits').notNull().default(1),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    // Set to windowStart + window_duration at insert time.
    // Cleanup cron: DELETE FROM rate_limit_entries WHERE expires_at < NOW()
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    index('rate_limit_entries_expires_at_idx').on(table.expiresAt),
  ],
);

export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;
