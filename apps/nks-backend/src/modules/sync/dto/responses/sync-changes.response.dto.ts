export interface SyncChange {
  table: string;
  id: number;
  operation: 'upsert' | 'delete';
  data: Record<string, unknown> | null;
}

export interface ChangesResponse {
  nextCursor: number;
  hasMore: boolean;
  changes: SyncChange[];
}

export interface PushResponse {
  processed: number;
}
