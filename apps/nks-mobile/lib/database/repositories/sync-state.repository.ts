/**
 * SyncStateRepository
 *
 * Key-value store for sync cursors and timestamps.
 *
 * Per-table cursors:
 *   getCursorForTable('state')           → number (0 = never synced)
 *   saveCursorForTable('state', 1714000000)
 *
 * The cursor value is a Unix millisecond timestamp.
 * It represents the `updated_at` of the last change successfully applied
 * from the server for that table.
 *
 * Meta keys (from SYNC_KEYS):
 *   LAST_PULL_AT       → timestamp of last completed pull
 *   LAST_PUSH_AT       → timestamp of last completed push
 *   LAST_FULL_SYNC_AT  → timestamp of last full pull + push cycle
 */

import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { syncState } from '../schema';
import type { SyncStateRow } from '../schema';
import type { SyncKey } from '../constants/sync-keys';
import { createLogger } from '../../utils/logger';

const log = createLogger('SyncStateRepository');

export class SyncStateRepository {
  private get db() { return getDatabase(); }

  // ── Per-Table Cursor ───────────────────────────────────────────────────────

  /**
   * Get the sync cursor for a specific table.
   * Returns 0 if the table has never been synced.
   *
   * The cursor key format is: `cursor:{tableName}`
   * e.g. 'cursor:routes', 'cursor:stores', 'cursor:entity_permissions'
   */
  async getCursorForTable(table: string): Promise<number> {
    try {
      const key = `cursor:${table}` as SyncKey;
      const row = await this.db
        .select()
        .from(syncState)
        .where(eq(syncState.key, key))
        .limit(1);
      return row[0]?.value ? parseInt(row[0].value, 10) : 0;
    } catch (err) {
      log.error(`Failed to get cursor for ${table}:`, err);
      return 0;
    }
  }

  /**
   * Save the sync cursor for a specific table.
   * Only advances — never goes backwards (prevents re-applying old changes).
   */
  async saveCursorForTable(table: string, cursorMs: number): Promise<void> {
    try {
      const current = await this.getCursorForTable(table);
      if (cursorMs <= current) return; // never go backwards

      const key = `cursor:${table}` as SyncKey;
      await this.db
        .insert(syncState)
        .values({ key, value: String(cursorMs) })
        .onConflictDoUpdate({ target: syncState.key, set: { value: String(cursorMs) } });
    } catch (err) {
      log.error(`Failed to save cursor for ${table}:`, err);
    }
  }

  /**
   * Reset a table's cursor to 0 (forces full re-sync on next pull).
   * Use when a schema migration requires re-fetching all data for a table.
   */
  async resetCursorForTable(table: string): Promise<void> {
    try {
      const key = `cursor:${table}` as SyncKey;
      await this.db
        .insert(syncState)
        .values({ key, value: '0' })
        .onConflictDoUpdate({ target: syncState.key, set: { value: '0' } });
    } catch (err) {
      log.error(`Failed to reset cursor for ${table}:`, err);
    }
  }

  // ── Generic Key-Value ──────────────────────────────────────────────────────

  async getValue(key: SyncKey): Promise<string | null> {
    try {
      const result = await this.db
        .select()
        .from(syncState)
        .where(eq(syncState.key, key))
        .limit(1);
      return result[0]?.value ?? null;
    } catch (err) {
      log.error(`Failed to get value [${key}]:`, err);
      return null;
    }
  }

  async setValue(key: SyncKey, value: string): Promise<void> {
    try {
      await this.db
        .insert(syncState)
        .values({ key, value })
        .onConflictDoUpdate({ target: syncState.key, set: { value } });
    } catch (err) {
      log.error(`Failed to set value [${key}]:`, err);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    try {
      await this.db.delete(syncState);
    } catch (err) {
      log.error('Failed to clear sync state:', err);
    }
  }
}

export const syncStateRepository = new SyncStateRepository();

export type { SyncStateRow };
