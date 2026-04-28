import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * Dead-letter store for mutations that exceeded max retries or were permanently
 * rejected by the server. Kept for admin review UI and audit trail.
 * Spec §3.4 — separate from mutation_queue so quarantined ops don't pollute
 * the active queue or affect queue-depth metrics.
 */
export const failedOperations = sqliteTable(
  'failed_operations',
  {
    id:               integer('id').primaryKey({ autoIncrement: true }),
    idempotency_key:  text('idempotency_key').notNull().unique(),
    operation:        text('operation').notNull(),
    entity:           text('entity').notNull(),
    payload:          text('payload').notNull(),          // JSON string
    error_code:       integer('error_code'),
    error_msg:        text('error_msg'),
    device_id:        text('device_id').notNull().default(''),
    created_at:       integer('created_at').notNull(),    // Unix ms — original enqueue time
    failed_at:        integer('failed_at').notNull(),     // Unix ms — when moved here
    resolved:         integer('resolved').notNull().default(0),  // 0=open, 1=resolved
    resolved_at:      integer('resolved_at'),             // Unix ms
  },
  (t) => [
    index('idx_fo_entity').on(t.entity),
    index('idx_fo_resolved').on(t.resolved),
  ],
);

export type FailedOperationRow    = typeof failedOperations.$inferSelect;
export type InsertFailedOperation = Omit<typeof failedOperations.$inferInsert, 'id'>;
