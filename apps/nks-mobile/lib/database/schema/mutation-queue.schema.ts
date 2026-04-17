import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const mutationQueue = sqliteTable(
  'mutation_queue',
  {
    id:               integer('id').primaryKey({ autoIncrement: true }),
    idempotency_key:  text('idempotency_key').notNull().unique(), // uuidv7 — deduplication on retry
    operation:        text('operation').notNull(),
    entity:           text('entity').notNull(),
    payload:          text('payload').notNull(),                  // JSON string
    status:           text('status').notNull().default('pending'),
    // 'pending' | 'in_progress' | 'synced' | 'failed' | 'quarantined'
    retries:          integer('retries').notNull().default(0),
    max_retries:      integer('max_retries').notNull().default(5),
    next_retry_at:    integer('next_retry_at'),                   // Unix ms, null = ready now
    last_error_code:  integer('last_error_code'),
    last_error_msg:   text('last_error_msg'),
    device_id:        text('device_id').notNull(),
    created_at:       integer('created_at').notNull(),            // Unix ms
    synced_at:        integer('synced_at'),                       // Unix ms
    expires_at:       integer('expires_at'),                      // Unix ms TTL
  },
  (t) => [
    index('idx_mq_status').on(t.status),
    index('idx_mq_next_retry').on(t.next_retry_at),
  ],
);

export type MutationQueueRow    = typeof mutationQueue.$inferSelect;
export type InsertMutationQueue = Omit<typeof mutationQueue.$inferInsert, 'id'>;
