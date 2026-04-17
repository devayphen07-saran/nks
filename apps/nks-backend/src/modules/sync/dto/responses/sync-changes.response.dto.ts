export interface SyncChange {
  table: string;
  id: number;
  operation: 'upsert' | 'delete';
  data: Record<string, unknown> | null;
  /** Unix ms timestamp of the row's updated_at — used by mobile to advance its per-table cursor */
  updatedAt: number;
}

export interface ChangesResponse {
  nextCursor: number;
  hasMore: boolean;
  changes: SyncChange[];
}

export interface PushResponse {
  processed: number;
}
