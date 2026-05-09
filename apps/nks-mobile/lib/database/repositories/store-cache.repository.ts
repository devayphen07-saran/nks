import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { storeCache } from '../schema';
import type { StoreCacheRow } from '../schema';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Bandwidth-saving cache for previously-synced stores.
 *
 * When a user switches back to a store they recently used, the replicator can
 * skip the full re-download by checking this table. The actual store data
 * still lives in the live tables — this is a marker that says "we have it".
 */
export class StoreCacheRepository {
  private get db() { return getDatabase(); }

  async save(params: {
    storeId:        number;
    storeGuuid:     string;
    storeName:      string;
    estimatedSize?: number;
    ttlMs?:         number;
  }): Promise<void> {
    const now = Date.now();
    const expiresAt = now + (params.ttlMs ?? DEFAULT_TTL_MS);

    await this.db
      .insert(storeCache)
      .values({
        storeId:        params.storeId,
        storeGuuid:     params.storeGuuid,
        storeName:      params.storeName,
        estimatedSize:  params.estimatedSize ?? null,
        lastAccessedAt: now,
        expiresAt,
        isValid:        1,
        createdAt:      now,
      })
      .onConflictDoUpdate({
        target: storeCache.storeId,
        set: {
          storeGuuid:     params.storeGuuid,
          storeName:      params.storeName,
          estimatedSize:  params.estimatedSize ?? null,
          lastAccessedAt: now,
          expiresAt,
          isValid:        1,
        },
      });
  }

  async getFresh(storeId: number): Promise<StoreCacheRow | null> {
    const rows = await this.db
      .select()
      .from(storeCache)
      .where(eq(storeCache.storeId, storeId))
      .limit(1);

    const entry = rows[0];
    if (!entry || entry.isValid === 0) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      await this.invalidate(storeId);
      return null;
    }

    await this.db
      .update(storeCache)
      .set({ lastAccessedAt: Date.now() })
      .where(eq(storeCache.storeId, storeId));

    return entry;
  }

  async invalidate(storeId: number): Promise<void> {
    await this.db
      .update(storeCache)
      .set({ isValid: 0 })
      .where(eq(storeCache.storeId, storeId));
  }

  async clear(): Promise<void> {
    await this.db.delete(storeCache);
  }
}

export const storeCacheRepository = new StoreCacheRepository();
