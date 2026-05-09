/**
 * Pull response sent to mobile.
 *
 * Contains server_time (transactionally consistent with data),
 * paginated changes, and next_cursor for the following pull.
 */
export interface PullResponse {
  server_time: string; // ISO 8601 timestamp (from REPEATABLE READ transaction start)
  entity: string; // Entity type
  changes: Array<{
    id: string; // Entity UUID
    operation: 'upsert' | 'delete';
    data: Record<string, unknown> | null; // null for deletes
  }>;
  has_more: boolean; // True if more rows exist beyond this page
  next_cursor: string; // Use in next pull to resume pagination
}
