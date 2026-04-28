export interface SyncChange {
  table: string;
  operation: 'upsert' | 'delete';
  data: Record<string, unknown> | null;
  /** Unix ms timestamp of the row's updated_at — used by mobile to advance its per-table cursor */
  updatedAt: number;
}

/**
 * Per-table compound cursors: { state: "timestampMs:rowId", district: "timestampMs:rowId" }
 *
 * Each table advances independently. A plain single cursor caused over-fetch
 * when one table was behind others — the server had to re-deliver rows for
 * fully-synced tables. With per-table cursors each table only receives rows
 * newer than its own last-applied row.
 *
 * Format per entry: "0:0" (initial), "1713500000000:42" (timestamp ms : last row id)
 */
export interface ChangesResponse {
  /** ISO timestamp from server clock — mobile stores this as its next LAST_PULL_AT */
  serverTime: string;
  /** Per-table compound cursors — mobile stores each independently */
  nextCursors: Record<string, string>;
  hasMore: boolean;
  changes: SyncChange[];
}

export type OpResultStatus = 'ok' | 'duplicate' | 'conflict' | 'rejected' | 'error';

export interface PushOpResult {
  /** Matches SyncOperation.id — the mobile's idempotency key for this operation */
  opId: string;
  status: OpResultStatus;
  /** Present on rejected/conflict/error — human-readable reason code */
  reason?: string;
  /** Present on conflict — the current server row so mobile can resolve */
  serverState?: unknown;
}

export interface PushResponse {
  /** ISO timestamp from server clock — mobile stores this as last_pushed_at cursor */
  serverTime: string;
  results: PushOpResult[];
}
