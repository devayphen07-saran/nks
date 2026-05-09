import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { syncMetadata } from '../schema';
import type { SyncMetadataRow } from '../schema';

export interface MetadataUpdate {
  lastSyncTimestamp?:    number;
  recommendedRefreshAt?: number;
  requiredRefreshAt?:    number;
  commitLogPhase?:       string | null;
  commitLogData?:        string | null;
  configVersion?:        number;
  configHash?:           string;
  configFetchedAt?:      number;
  checksumHash?:         string;
  rowsTotal?:            number;
}

/**
 * Per-store sync bookkeeping: data freshness, config hash, and crash-recovery
 * commit log. One row per store. Read frequently, written at sync milestones.
 */
export class SyncMetadataRepository {
  private get db() { return getDatabase(); }

  async get(storeId: number): Promise<SyncMetadataRow | null> {
    const rows = await this.db
      .select()
      .from(syncMetadata)
      .where(eq(syncMetadata.storeId, storeId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(storeId: number, update: MetadataUpdate): Promise<void> {
    const existing = await this.get(storeId);

    if (!existing) {
      await this.db.insert(syncMetadata).values({
        storeId,
        lastSyncTimestamp:    update.lastSyncTimestamp    ?? null,
        recommendedRefreshAt: update.recommendedRefreshAt ?? null,
        requiredRefreshAt:    update.requiredRefreshAt    ?? null,
        commitLogPhase:       update.commitLogPhase       ?? null,
        commitLogData:        update.commitLogData        ?? null,
        configVersion:        update.configVersion        ?? null,
        configHash:           update.configHash           ?? null,
        configFetchedAt:      update.configFetchedAt      ?? null,
        checksumHash:         update.checksumHash         ?? null,
        rowsTotal:            update.rowsTotal            ?? null,
      });
      return;
    }

    await this.db
      .update(syncMetadata)
      .set({
        lastSyncTimestamp:    update.lastSyncTimestamp    ?? existing.lastSyncTimestamp,
        recommendedRefreshAt: update.recommendedRefreshAt ?? existing.recommendedRefreshAt,
        requiredRefreshAt:    update.requiredRefreshAt    ?? existing.requiredRefreshAt,
        commitLogPhase:       update.commitLogPhase       === undefined ? existing.commitLogPhase : update.commitLogPhase,
        commitLogData:        update.commitLogData        === undefined ? existing.commitLogData  : update.commitLogData,
        configVersion:        update.configVersion        ?? existing.configVersion,
        configHash:           update.configHash           ?? existing.configHash,
        configFetchedAt:      update.configFetchedAt      ?? existing.configFetchedAt,
        checksumHash:         update.checksumHash         ?? existing.checksumHash,
        rowsTotal:            update.rowsTotal            ?? existing.rowsTotal,
      })
      .where(eq(syncMetadata.storeId, storeId));
  }

  async deleteForStore(storeId: number): Promise<void> {
    await this.db.delete(syncMetadata).where(eq(syncMetadata.storeId, storeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(syncMetadata);
  }
}

export const syncMetadataRepository = new SyncMetadataRepository();
