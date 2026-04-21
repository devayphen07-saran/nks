export interface SyncChange {
  table: string;
  id: number;
  operation: 'upsert' | 'delete';
  data: Record<string, unknown> | null;
  /** Unix ms timestamp of the row's updated_at — used by mobile to advance its per-table cursor */
  updatedAt: number;
}

/**
 * Compound cursor: "timestampMs:rowId"
 *
 * A plain ms-epoch cursor loses rows when two rows share the same updated_at
 * and straddle a page boundary. The compound cursor breaks ties by row id,
 * guaranteeing every row is delivered exactly once.
 *
 * Format: "0:0" (initial), "1713500000000:42" (timestamp ms : last row id)
 */
export interface ChangesResponse {
  nextCursor: string;
  hasMore: boolean;
  changes: SyncChange[];
}

export interface PushResponse {
  processed: number;
}
