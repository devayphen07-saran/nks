import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { storeDataStaging } from '../schema';

/**
 * Staging-table cleanup helpers.
 *
 * The staging table was originally designed as a write-then-promote buffer
 * for sync downloads, but the replicator now writes directly to live
 * tables. Only the cleanup methods are still used: `rollback` for the
 * store-switch failure path and `clear` for logout. The write/read API
 * was removed when no caller materialized — re-add only with a real
 * caller, not on speculation.
 */
export class StagingRepository {
  private get db() { return getDatabase(); }

  async rollback(storeId: number): Promise<void> {
    await this.db.delete(storeDataStaging).where(eq(storeDataStaging.storeId, storeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(storeDataStaging);
  }
}

export const stagingRepository = new StagingRepository();
