/**
 * Sync Status Utilities
 *
 * Single source of truth for answering:
 *   "Is this table synced?"
 *   "When was this table last synced?"
 *   "How many mutations are waiting?"
 *
 * Used by:
 *   - UI to show sync indicator / stale data warnings
 *   - sync-engine to decide which tables need a full re-sync
 */

import { syncStateRepository } from "../database/repositories/sync-state.repository";
import { mutationQueueRepository } from "../database/repositories/mutation-queue.repository";
import { SYNC_KEYS } from "../database/constants/sync-keys";
import { SYNC_TABLES } from "./sync-table-handlers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncHealthStatus = "synced" | "stale" | "never_synced" | "unknown";

export interface TableSyncStatus {
  table: string;
  cursor: number; // 0 = never synced
  isSynced: boolean; // cursor > 0
  lastSyncedAt: number | null; // same as cursor for cursor-based tables
  health: SyncHealthStatus;
}

export interface QueueStatus {
  pending: number;
  inProgress: number;
  failed: number;
  quarantined: number;
  total: number;
}

export interface SyncStatus {
  tables: Record<string, TableSyncStatus>;
  queue: QueueStatus;
  lastFullSyncAt: number | null;
}

// Stale threshold — 1 hour for cursor-based tables
const TABLE_STALE_THRESHOLD_MS = 60 * 60 * 1000;

// ─── Per-Table Sync Check ─────────────────────────────────────────────────────

/**
 * Check if a specific table has been synced at least once.
 *
 * @example
 * const ready = await isTableSynced('entity_permissions');
 * if (!ready) {
 *   // permissions not loaded — deny offline writes
 * }
 */
export async function isTableSynced(table: string): Promise<boolean> {
  const cursor = await syncStateRepository.getCursorForTable(table);
  return cursor > 0;
}

/**
 * Get sync staleness for a table.
 *
 * Returns:
 *  'never_synced' — cursor is 0
 *  'synced'       — cursor > 0 AND age < 1 hour
 *  'stale'        — cursor > 0 BUT age > 1 hour
 */
export async function getTableHealth(table: string): Promise<SyncHealthStatus> {
  const cursor = await syncStateRepository.getCursorForTable(table);

  if (cursor === 0) return "never_synced";

  const ageMs = Date.now() - cursor;
  return ageMs < TABLE_STALE_THRESHOLD_MS ? "synced" : "stale";
}

// ─── Full Sync Status Snapshot ────────────────────────────────────────────────

/**
 * Get the complete sync status for all tables and the mutation queue.
 * Use this for the sync status indicator in the UI.
 *
 * @example
 * const status = await getSyncStatus();
 * console.log(status.queue.quarantined); // mutations that need attention
 * console.log(status.tables['state'].isSynced); // states loaded?
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  // Fetch all table cursors in parallel
  const tableStatuses = await Promise.all(
    SYNC_TABLES.map(async (table): Promise<[string, TableSyncStatus]> => {
      const cursor = await syncStateRepository.getCursorForTable(table);
      const ageMs = cursor > 0 ? Date.now() - cursor : Infinity;
      const health: SyncHealthStatus =
        cursor === 0
          ? "never_synced"
          : ageMs < TABLE_STALE_THRESHOLD_MS
            ? "synced"
            : "stale";

      return [
        table,
        {
          table,
          cursor,
          isSynced: cursor > 0,
          lastSyncedAt: cursor > 0 ? cursor : null,
          health,
        },
      ];
    }),
  );

  // Mutation queue counts
  const [pending, inProgress, failed, quarantined] = await Promise.all([
    mutationQueueRepository.countByStatus("pending"),
    mutationQueueRepository.countByStatus("in_progress"),
    mutationQueueRepository.countByStatus("failed"),
    mutationQueueRepository.countByStatus("quarantined"),
  ]);

  // Meta keys
  const lastFullSyncStr = await syncStateRepository.getValue(
    SYNC_KEYS.LAST_FULL_SYNC_AT,
  );

  return {
    tables: Object.fromEntries(tableStatuses),
    queue: {
      pending,
      inProgress,
      failed,
      quarantined,
      total: pending + inProgress + failed + quarantined,
    },
    lastFullSyncAt: lastFullSyncStr ? parseInt(lastFullSyncStr, 10) : null,
  };
}

// ─── Convenience Checks ───────────────────────────────────────────────────────

/**
 * True when all critical tables have been synced at least once.
 * Used by the app to decide if it's safe to go into offline POS mode.
 */
export async function isReadyForOffline(): Promise<{
  ready: boolean;
  missing: string[];
}> {
  const CRITICAL_TABLES = ['state', 'district'];

  const results = await Promise.all(
    CRITICAL_TABLES.map(async (t) => ({
      table: t,
      isSynced: await isTableSynced(t),
    })),
  );

  const missing = results.filter((r) => !r.isSynced).map((r) => r.table);

  return { ready: missing.length === 0, missing };
}

/**
 * True when location reference tables (state + district) have been synced at least once.
 * If false, write-guard should deny offline writes that depend on location data.
 */
export async function arePermissionsLoaded(): Promise<boolean> {
  const [stateReady, districtReady] = await Promise.all([
    isTableSynced('state'),
    isTableSynced('district'),
  ]);
  return stateReady && districtReady;
}
