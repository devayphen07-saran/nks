import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const mutationQueue = sqliteTable(
  'mutation_queue',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    idempotency_key: text('idempotency_key').notNull().unique(),
    store_id:        integer('store_id'),

    // entity identification
    client_op_id:    text('client_op_id').notNull().unique(),
    entity:          text('entity').notNull(),
    entity_id:       text('entity_id'),
    operation:       text('operation').notNull(),
    payload:         text('payload').notNull(),         // JSON

    // FIX #11: conflict version tracking
    version:         integer('version').notNull().default(1),
    base_version:    integer('base_version'),

    // FIX #3: user attribution for permission checks
    user_id:         text('user_id'),
    timestamp:       integer('timestamp'),

    // FIX #5: conflict resolution fields
    changed_fields:  text('changed_fields'),            // JSON array
    previous_value:  text('previous_value'),            // JSON
    conflict_data:   text('conflict_data'),             // full conflict response JSON
    resolved_at:     integer('resolved_at'),
    resolution:      text('resolution'),                // use_local | use_server | merged | manual

    // FIX #12: server receipt
    server_timestamp: integer('server_timestamp'),
    server_receipt_id: text('server_receipt_id'),

    // status & retry
    status:          text('status').notNull().default('pending'),
    // pending | in_progress | pending_blocked | synced | done | failed | conflict | quarantined
    priority:        integer('priority').notNull().default(5),
    retries:         integer('retries').notNull().default(0),
    max_retries:     integer('max_retries').notNull().default(5),
    next_retry_at:   integer('next_retry_at'),
    last_error_code: integer('last_error_code'),
    last_error_msg:  text('last_error_msg'),

    device_id:       text('device_id').notNull(),
    created_at:      integer('created_at').notNull(),
    updated_at:      integer('updated_at'),
    synced_at:       integer('synced_at'),
    expires_at:      integer('expires_at'),
  },
  (t) => [
    index('idx_mq_status').on(t.status),
    index('idx_mq_next_retry').on(t.next_retry_at),
    index('idx_mq_priority').on(t.priority),
    index('idx_mq_store_status').on(t.store_id, t.status),
  ],
);

export type MutationQueueRow    = typeof mutationQueue.$inferSelect;
export type InsertMutationQueue = Omit<typeof mutationQueue.$inferInsert, 'id'>;

// ── mutation_queue_log ─────────────────────────────────────────────────────
// FIX #10: deduplication log — prevents double-push on retry.

export const mutationQueueLog = sqliteTable(
  'mutation_queue_log',
  {
    id:              integer('id').primaryKey({ autoIncrement: true }),
    idempotencyKey:  text('idempotency_key').notNull().unique(),
    mutationId:      integer('mutation_id'),
    resultId:        text('result_id'),
    status:          text('status').notNull(),  // ok | duplicate | rejected | failed
    serverTimestamp: integer('server_timestamp'),
    createdAt:       integer('created_at').notNull(),
  },
);

export type MutationQueueLogRow    = typeof mutationQueueLog.$inferSelect;
export type InsertMutationQueueLog = typeof mutationQueueLog.$inferInsert;
