import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { storeSyncProgress } from '../schema';
import type { StoreSyncProgressRow } from '../schema';

export type SyncProgressStatus = 'pending' | 'in_progress' | 'complete' | 'failed';

export interface ProgressUpdate {
  lastSyncTimestamp?: number;
  lastChangeSetId?:   string;
  rowsDownloaded?:    number;
  rowsTotal?:         number;
  status?:            SyncProgressStatus;
  error?:             string | null;
}

/**
 * Per-store, per-entity sync cursor.
 *
 * Tracks how far along each entity sync is, so the replicator can resume
 * after a crash or transient failure without re-downloading data.
 */
export class StoreSyncProgressRepository {
  private get db() { return getDatabase(); }

  async getProgress(storeId: number, entityType: string): Promise<StoreSyncProgressRow | null> {
    const rows = await this.db
      .select()
      .from(storeSyncProgress)
      .where(
        and(
          eq(storeSyncProgress.storeId, storeId),
          eq(storeSyncProgress.entityType, entityType),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async updateProgress(storeId: number, entityType: string, update: ProgressUpdate): Promise<void> {
    const existing = await this.getProgress(storeId, entityType);
    const now = Date.now();

    if (!existing) {
      await this.db.insert(storeSyncProgress).values({
        storeId,
        entityType,
        lastSyncTimestamp: update.lastSyncTimestamp ?? null,
        lastChangeSetId:   update.lastChangeSetId ?? null,
        rowsDownloaded:    update.rowsDownloaded ?? 0,
        rowsTotal:         update.rowsTotal ?? null,
        status:            update.status ?? 'pending',
        error:             update.error ?? null,
        lastProgressAt:    now,
        updatedAt:         now,
      });
      return;
    }

    await this.db
      .update(storeSyncProgress)
      .set({
        lastSyncTimestamp: update.lastSyncTimestamp ?? existing.lastSyncTimestamp,
        lastChangeSetId:   update.lastChangeSetId  ?? existing.lastChangeSetId,
        rowsDownloaded:    update.rowsDownloaded   ?? existing.rowsDownloaded,
        rowsTotal:         update.rowsTotal        ?? existing.rowsTotal,
        status:            update.status           ?? existing.status,
        error:             update.error === undefined ? existing.error : update.error,
        lastProgressAt:    now,
        updatedAt:         now,
      })
      .where(eq(storeSyncProgress.id, existing.id));
  }

  async resetForStore(storeId: number): Promise<void> {
    await this.db.delete(storeSyncProgress).where(eq(storeSyncProgress.storeId, storeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(storeSyncProgress);
  }
}

export const storeSyncProgressRepository = new StoreSyncProgressRepository();
