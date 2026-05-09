import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * processedOperations — the idempotency cache for POST /sync/push.
 *
 * Every push operation carries a clientOpId (UUID generated on the device).
 * Before applying it the sync service checks this table; on hit it returns
 * the cached result instead of re-running the operation. Retries are safe.
 *
 * IMPORTANT: only terminal results (ok, duplicate, conflict, rejected) are
 * saved here. Transient errors and unknown-entity errors are NOT cached —
 * caching them would dead-key the operation and prevent valid retries.
 *
 * Retention: 90 days. The daily cleanup scheduler deletes older rows. A
 * device offline longer than that must full-rebootstrap (the offline window
 * is bounded by the tombstone GC horizon, which uses the same 90-day TTL).
 */
export const processedOperations = pgTable(
  'processed_operations',
  {
    clientOpId: uuid('client_op_id').primaryKey(),
    deviceId: text('device_id').notNull(),
    entityType: text('entity_type').notNull(),
    result: jsonb('result').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('processed_operations_device_idx').on(
      table.deviceId,
      table.processedAt,
    ),
    index('processed_operations_processed_at_idx').on(table.processedAt),
  ],
);

export type ProcessedOperation = typeof processedOperations.$inferSelect;
export type NewProcessedOperation = typeof processedOperations.$inferInsert;
