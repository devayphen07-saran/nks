/**
 * Typed keys for the sync_state key-value table.
 *
 * Per-table cursor keys are NOT listed here. The pull engine derives them
 * dynamically as `cursor:<table>` from the entries in TABLE_HANDLERS, so
 * keeping a duplicate static list just goes stale (see commit history).
 */
export const SYNC_KEYS = {
  /** Unix ms timestamp of the last completed pull cycle (server time). */
  LAST_PULL_AT:       'sync:lastPullAt',
  /** Unix ms timestamp of the last completed push cycle (server time). */
  LAST_PUSH_AT:       'sync:lastPushAt',
  /** Unix ms timestamp of the last full pull+push cycle. */
  LAST_FULL_SYNC_AT:  'sync:lastFullSyncAt',
} as const;

export type SyncKey = typeof SYNC_KEYS[keyof typeof SYNC_KEYS];
