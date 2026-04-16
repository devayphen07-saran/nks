import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * Database-backed rate limiting table.
 * One row per unique key (IP address). Tracks hits within the current window.
 * Survives restarts and is shared across all replica instances.
 *
 * Created by migration 022_rate_limit_entries.sql
 */
export const rateLimitEntries = pgTable('rate_limit_entries', {
  key: text('key').primaryKey(),
  hits: integer('hits').notNull().default(1),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
});

export type RateLimitEntry = typeof rateLimitEntries.$inferSelect;
