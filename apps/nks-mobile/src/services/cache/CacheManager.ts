/**
 * ✅ MODULE 6 PHASE 2: Cache Manager Service
 *
 * Purpose:
 * - Manage cache lifecycle (get, set, invalidate, clear)
 * - Handle TTL-based expiry
 * - Track pending mutations
 * - Provide queries for cache entries
 * - Manage metadata and statistics
 */

import { Logger } from '@/utils/logger';
import {
  getSQLiteDatabase,
  CacheEntry,
  PendingMutation,
  CacheMetadata,
} from '@/database/sqlite.config';

export interface CachePolicy {
  ttl: number; // Time-to-live in milliseconds
  maxSize?: number; // Max size in bytes
  revalidateOnFocus?: boolean;
  persistAcrossAppRestart?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  etag?: string;
  status?: 'FRESH' | 'STALE' | 'PENDING';
}

class CacheManager {
  private readonly logger = new Logger('CacheManager');
  private policies: Map<string, CachePolicy> = new Map();
  private DEFAULT_TTL = 1 * 60 * 60 * 1000; // 1 hour

  /**
   * Register cache policy for a resource type
   */
  registerPolicy(resourceType: string, policy: CachePolicy): void {
    this.policies.set(resourceType, policy);
    this.logger.debug(`✅ Policy registered for ${resourceType}`);
  }

  /**
   * Get policy for resource type
   */
  getPolicy(resourceType: string): CachePolicy {
    return (
      this.policies.get(resourceType) || {
        ttl: this.DEFAULT_TTL,
        revalidateOnFocus: true,
        persistAcrossAppRestart: true,
      }
    );
  }

  /**
   * Get cache entry
   */
  async get<T>(
    resourceType: string,
    resourceId?: string
  ): Promise<T | null> {
    try {
      const db = await getSQLiteDatabase();

      const entry = await db.queryOne<CacheEntry>(
        `SELECT * FROM cache_entries
         WHERE resource_type = ? AND resource_id IS ?`,
        [resourceType, resourceId ?? null]
      );

      if (!entry) {
        return null;
      }

      // Check if expired
      if (entry.expires_at < Date.now()) {
        await this.invalidate(resourceType, resourceId);
        return null;
      }

      try {
        return JSON.parse(entry.data) as T;
      } catch (error) {
        this.logger.warn(`⚠️ Failed to parse cached data for ${resourceType}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`❌ Failed to get cache for ${resourceType}`, error);
      return null;
    }
  }

  /**
   * Set cache entry
   */
  async set(
    resourceType: string,
    data: unknown,
    resourceId?: string,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const db = await getSQLiteDatabase();
      const policy = this.getPolicy(resourceType);
      const ttl = options.ttl ?? policy.ttl;

      const entry: Omit<CacheEntry, 'id'> = {
        resource_type: resourceType,
        resource_id: resourceId ?? null,
        data: JSON.stringify(data),
        status: options.status ?? 'FRESH',
        created_at: Date.now(),
        updated_at: Date.now(),
        expires_at: Date.now() + ttl,
        etag: options.etag ?? null,
      };

      const id = `${resourceType}:${resourceId ?? 'all'}`;

      await db.transaction(async () => {
        await db.execute(
          `INSERT OR REPLACE INTO cache_entries
           (id, resource_type, resource_id, data, status, created_at, updated_at, expires_at, etag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            entry.resource_type,
            entry.resource_id,
            entry.data,
            entry.status,
            entry.created_at,
            entry.updated_at,
            entry.expires_at,
            entry.etag,
          ]
        );

        // Update metadata
        await db.execute(
          `UPDATE cache_metadata
           SET total_entries = (SELECT COUNT(*) FROM cache_entries)
           WHERE id = ?`,
          ['__metadata']
        );
      });

      this.logger.debug(`✅ Cached ${resourceType}${resourceId ? `:${resourceId}` : ''}`);
    } catch (error) {
      this.logger.error(`❌ Failed to set cache for ${resourceType}`, error);
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(resourceType: string, resourceId?: string): Promise<void> {
    try {
      const db = await getSQLiteDatabase();

      await db.transaction(async () => {
        if (resourceId) {
          await db.execute(
            `DELETE FROM cache_entries
             WHERE resource_type = ? AND resource_id = ?`,
            [resourceType, resourceId]
          );
        } else {
          await db.execute(
            `DELETE FROM cache_entries WHERE resource_type = ?`,
            [resourceType]
          );
        }

        // Update metadata
        await db.execute(
          `UPDATE cache_metadata
           SET total_entries = (SELECT COUNT(*) FROM cache_entries)
           WHERE id = ?`,
          ['__metadata']
        );
      });

      this.logger.debug(
        `✅ Invalidated ${resourceType}${resourceId ? `:${resourceId}` : ''}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to invalidate ${resourceType}`,
        error
      );
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    try {
      const db = await getSQLiteDatabase();

      await db.transaction(async () => {
        await db.execute('DELETE FROM cache_entries');
        await db.execute(
          `UPDATE cache_metadata SET total_entries = 0 WHERE id = ?`,
          ['__metadata']
        );
      });

      this.logger.log('✅ Cache cleared');
    } catch (error) {
      this.logger.error('❌ Failed to clear cache', error);
    }
  }

  /**
   * Record mutation (CREATE/UPDATE/DELETE)
   */
  async recordMutation(
    resourceType: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload: unknown,
    resourceId?: string
  ): Promise<string> {
    try {
      const db = await getSQLiteDatabase();
      const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await db.transaction(async () => {
        await db.execute(
          `INSERT OR REPLACE INTO pending_mutations
           (id, resource_type, resource_id, operation, payload, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            mutationId,
            resourceType,
            resourceId ?? null,
            operation,
            JSON.stringify(payload),
            'PENDING',
            Date.now(),
          ]
        );

        // Update metadata
        await db.execute(
          `UPDATE cache_metadata
           SET total_mutations = (SELECT COUNT(*) FROM pending_mutations WHERE status = 'PENDING')
           WHERE id = ?`,
          ['__metadata']
        );
      });

      this.logger.debug(
        `✅ Recorded ${operation} mutation for ${resourceType}:${resourceId || 'all'}`
      );
      return mutationId;
    } catch (error) {
      this.logger.error(
        `❌ Failed to record mutation for ${resourceType}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all pending mutations
   */
  async getPendingMutations(): Promise<PendingMutation[]> {
    try {
      const db = await getSQLiteDatabase();

      const mutations = await db.query<PendingMutation>(
        `SELECT * FROM pending_mutations WHERE status = 'PENDING' ORDER BY created_at ASC`
      );

      return mutations;
    } catch (error) {
      this.logger.error('❌ Failed to get pending mutations', error);
      return [];
    }
  }

  /**
   * Get mutation by ID
   */
  async getMutation(mutationId: string): Promise<PendingMutation | null> {
    try {
      const db = await getSQLiteDatabase();

      return await db.queryOne<PendingMutation>(
        'SELECT * FROM pending_mutations WHERE id = ?',
        [mutationId]
      );
    } catch (error) {
      this.logger.error(`❌ Failed to get mutation ${mutationId}`, error);
      return null;
    }
  }

  /**
   * Link mutation to queue request
   */
  async linkMutationToRequest(
    mutationId: string,
    queueRequestId: string
  ): Promise<void> {
    try {
      const db = await getSQLiteDatabase();

      await db.execute(
        `UPDATE pending_mutations
         SET queue_request_id = ? WHERE id = ?`,
        [queueRequestId, mutationId]
      );

      this.logger.debug(`✅ Linked mutation ${mutationId} to queue request`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to link mutation to request`,
        error
      );
    }
  }

  /**
   * Mark mutation as synced
   */
  async syncMutation(mutationId: string): Promise<void> {
    try {
      const db = await getSQLiteDatabase();

      await db.transaction(async () => {
        await db.execute(
          `UPDATE pending_mutations
           SET status = 'SYNCED', synced_at = ? WHERE id = ?`,
          [Date.now(), mutationId]
        );

        // Update metadata
        await db.execute(
          `UPDATE cache_metadata
           SET total_mutations = (SELECT COUNT(*) FROM pending_mutations WHERE status = 'PENDING')
           WHERE id = ?`,
          ['__metadata']
        );
      });

      this.logger.debug(`✅ Marked mutation ${mutationId} as synced`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to sync mutation`,
        error
      );
    }
  }

  /**
   * Clear synced mutations
   */
  async clearSyncedMutations(): Promise<number> {
    try {
      const db = await getSQLiteDatabase();

      const result = await db.execute(
        `DELETE FROM pending_mutations WHERE status = 'SYNCED'`
      );

      const deletedCount = result?.rowsAffected ?? 0;

      if (deletedCount > 0) {
        // Update metadata
        await db.execute(
          `UPDATE cache_metadata
           SET total_mutations = (SELECT COUNT(*) FROM pending_mutations WHERE status = 'PENDING')
           WHERE id = ?`,
          ['__metadata']
        );
      }

      this.logger.log(`✅ Cleared ${deletedCount} synced mutations`);
      return deletedCount;
    } catch (error) {
      this.logger.error('❌ Failed to clear synced mutations', error);
      return 0;
    }
  }

  /**
   * Query cache by resource type
   */
  async queryByType(resourceType: string): Promise<unknown[]> {
    try {
      const db = await getSQLiteDatabase();

      const entries = await db.query<CacheEntry>(
        `SELECT * FROM cache_entries
         WHERE resource_type = ? AND expires_at > ?
         ORDER BY updated_at DESC`,
        [resourceType, Date.now()]
      );

      return entries.map((entry: CacheEntry) => {
        try {
          return JSON.parse(entry.data);
        } catch {
          return null;
        }
      }).filter((item: unknown) => item !== null);
    } catch (error) {
      this.logger.error(`❌ Failed to query ${resourceType}`, error);
      return [];
    }
  }

  /**
   * Get expired entries
   */
  async queryExpired(): Promise<CacheEntry[]> {
    try {
      const db = await getSQLiteDatabase();

      return await db.query<CacheEntry>(
        `SELECT * FROM cache_entries WHERE expires_at < ?`,
        [Date.now()]
      );
    } catch (error) {
      this.logger.error('❌ Failed to query expired entries', error);
      return [];
    }
  }

  /**
   * Check if cache is fresh
   */
  async isCacheFresh(
    resourceType: string,
    maxAge: number = 5 * 60 * 1000
  ): Promise<boolean> {
    try {
      const db = await getSQLiteDatabase();

      const entry = await db.queryOne<CacheEntry>(
        `SELECT * FROM cache_entries
         WHERE resource_type = ? AND updated_at > ?`,
        [resourceType, Date.now() - maxAge]
      );

      return entry !== null && entry.expires_at > Date.now();
    } catch (error) {
      this.logger.error(`❌ Failed to check if cache fresh`, error);
      return false;
    }
  }

  /**
   * Get cache metadata
   */
  async getMetadata(): Promise<CacheMetadata | null> {
    try {
      const db = await getSQLiteDatabase();

      return await db.queryOne<CacheMetadata>(
        'SELECT * FROM cache_metadata WHERE id = ?',
        ['__metadata']
      );
    } catch (error) {
      this.logger.error('❌ Failed to get metadata', error);
      return null;
    }
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<number> {
    try {
      const db = await getSQLiteDatabase();
      return await db.cleanupExpiredEntries();
    } catch (error) {
      this.logger.error('❌ Failed to cleanup cache', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalMutations: number;
    cachedResources: string[];
  }> {
    try {
      const metadata = await this.getMetadata();
      const db = await getSQLiteDatabase();

      const resources = await db.query<{ resource_type: string }>(
        'SELECT DISTINCT resource_type FROM cache_entries'
      );

      return {
        totalEntries: metadata?.total_entries ?? 0,
        totalMutations: metadata?.total_mutations ?? 0,
        cachedResources: resources.map((r: { resource_type: string }) => r.resource_type),
      };
    } catch (error) {
      this.logger.error('❌ Failed to get stats', error);
      return {
        totalEntries: 0,
        totalMutations: 0,
        cachedResources: [],
      };
    }
  }
}

// Singleton instance
let instance: CacheManager | null = null;

/**
 * Get or create CacheManager instance
 */
export function getCacheManager(): CacheManager {
  if (!instance) {
    instance = new CacheManager();
  }
  return instance;
}

export default CacheManager;
