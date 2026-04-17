/**
 * Typed keys for the sync_state key-value table.
 * Use these constants instead of raw strings to get compile-time safety.
 */
export const SYNC_KEYS = {
  CURSOR_ROUTES:      'cursor:routes',
  CURSOR_STORES:      'cursor:stores',
  CURSOR_LOOKUP:      'cursor:lookup',
  CURSOR_STATUS:      'cursor:status',
  LAST_SYNC_AT:       'sync:lastSyncAt',
  LAST_FULL_SYNC_AT:  'sync:lastFullSyncAt',
  LOOKUP_SYNCED_AT:   'sync:lookupSyncedAt',
} as const;

export type SyncKey = typeof SYNC_KEYS[keyof typeof SYNC_KEYS];
