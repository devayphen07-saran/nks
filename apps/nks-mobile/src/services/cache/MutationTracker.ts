/**
 * ✅ MODULE 6 PHASE 4: Mutation Tracker
 *
 * Purpose:
 * - Track CREATE/UPDATE/DELETE operations until sync
 * - Record original and optimistic data
 * - Handle rollback on conflicts
 * - Link mutations to queue requests
 * - Manage mutation lifecycle
 */

import { Logger } from '@/utils/logger';
import { getCacheManager } from './CacheManager';
import { getSQLiteDatabase, PendingMutation } from '@/database/sqlite.config';

export interface MutationRecord {
  id: string;
  resourceType: string;
  resourceId?: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  originalData: unknown;
  mutatedData: unknown;
  timestamp: number;
  queueRequestId?: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED' | 'REVERTED';
  syncedAt?: number;
}

class MutationTracker {
  private readonly logger = new Logger('MutationTracker');
  private cacheManager = getCacheManager();
  private mutations: Map<string, MutationRecord> = new Map();

  /**
   * Initialize: load pending mutations from database
   */
  async initialize(): Promise<void> {
    try {
      const pendingMutations = await this.cacheManager.getPendingMutations();

      for (const mutation of pendingMutations) {
        const record: MutationRecord = {
          id: mutation.id,
          resourceType: mutation.resource_type,
          resourceId: mutation.resource_id || undefined,
          operation: mutation.operation as any,
          originalData: null, // Would need to fetch from cache
          mutatedData: JSON.parse(mutation.payload),
          timestamp: mutation.created_at,
          queueRequestId: mutation.queue_request_id || undefined,
          status: (mutation.status as any) || 'PENDING',
          syncedAt: mutation.synced_at || undefined,
        };

        this.mutations.set(mutation.id, record);
      }

      this.logger.log(
        `✅ Initialized with ${this.mutations.size} pending mutations`
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize mutation tracker', error);
    }
  }

  /**
   * Track mutation (CREATE/UPDATE/DELETE)
   */
  async trackMutation(
    resourceType: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    payload: unknown,
    originalData?: unknown,
    resourceId?: string
  ): Promise<MutationRecord> {
    try {
      const mutationId = await this.cacheManager.recordMutation(
        resourceType,
        operation,
        payload,
        resourceId
      );

      const record: MutationRecord = {
        id: mutationId,
        resourceType,
        resourceId,
        operation,
        originalData: originalData ?? null,
        mutatedData: payload,
        timestamp: Date.now(),
        status: 'PENDING',
      };

      this.mutations.set(mutationId, record);

      this.logger.debug(
        `✅ Tracked ${operation} mutation for ${resourceType}${
          resourceId ? `:${resourceId}` : ''
        }`
      );

      return record;
    } catch (error) {
      this.logger.error(
        `❌ Failed to track mutation for ${resourceType}`,
        error
      );
      throw error;
    }
  }

  /**
   * Apply optimistic update (show change immediately in UI)
   */
  async optimisticUpdate<T>(
    resourceType: string,
    resourceId: string,
    changes: Partial<T>,
    originalData: T
  ): Promise<{
    mutationId: string;
    optimisticData: T;
  }> {
    try {
      // Merge changes with original data
      const optimisticData = {
        ...originalData,
        ...changes,
      };

      // Record mutation
      const mutation = await this.trackMutation(
        resourceType,
        'UPDATE',
        optimisticData,
        originalData,
        resourceId
      );

      this.logger.debug(
        `✅ Applied optimistic update for ${resourceType}:${resourceId}`
      );

      return {
        mutationId: mutation.id,
        optimisticData,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to apply optimistic update for ${resourceType}`,
        error
      );
      throw error;
    }
  }

  /**
   * Revert optimistic update (rollback on failure)
   */
  async revertMutation(mutationId: string): Promise<unknown> {
    try {
      const mutation = this.mutations.get(mutationId);
      if (!mutation) {
        throw new Error(`Mutation ${mutationId} not found`);
      }

      mutation.status = 'REVERTED';

      // Return original data so UI can restore
      this.logger.debug(`✅ Reverted mutation ${mutationId}`);

      return mutation.originalData;
    } catch (error) {
      this.logger.error(`❌ Failed to revert mutation ${mutationId}`, error);
      throw error;
    }
  }

  /**
   * Mark mutation as synced
   */
  async syncMutation(mutationId: string): Promise<void> {
    try {
      const mutation = this.mutations.get(mutationId);
      if (!mutation) {
        throw new Error(`Mutation ${mutationId} not found`);
      }

      mutation.status = 'SYNCED';
      mutation.syncedAt = Date.now();

      await this.cacheManager.syncMutation(mutationId);

      this.logger.debug(`✅ Marked mutation ${mutationId} as synced`);
    } catch (error) {
      this.logger.error(`❌ Failed to sync mutation ${mutationId}`, error);
    }
  }

  /**
   * Mark mutation as failed
   */
  async failMutation(mutationId: string): Promise<void> {
    try {
      const mutation = this.mutations.get(mutationId);
      if (!mutation) {
        throw new Error(`Mutation ${mutationId} not found`);
      }

      mutation.status = 'FAILED';

      const db = await getSQLiteDatabase();
      await db.execute(
        'UPDATE pending_mutations SET status = ? WHERE id = ?',
        ['FAILED', mutationId]
      );

      this.logger.debug(`✅ Marked mutation ${mutationId} as failed`);
    } catch (error) {
      this.logger.error(`❌ Failed to mark mutation as failed`, error);
    }
  }

  /**
   * Link mutation to queue request
   */
  async linkToQueueRequest(
    mutationId: string,
    queueRequestId: string
  ): Promise<void> {
    try {
      const mutation = this.mutations.get(mutationId);
      if (!mutation) {
        throw new Error(`Mutation ${mutationId} not found`);
      }

      mutation.queueRequestId = queueRequestId;

      await this.cacheManager.linkMutationToRequest(
        mutationId,
        queueRequestId
      );

      this.logger.debug(
        `✅ Linked mutation ${mutationId} to queue request`
      );
    } catch (error) {
      this.logger.error(`❌ Failed to link mutation to request`, error);
    }
  }

  /**
   * Reconcile mutation on sync completion
   * Merge server data with local changes
   */
  async reconcileOnSync(
    mutationId: string,
    serverData: unknown,
    strategy: 'server_wins' | 'client_wins' | 'merge'
  ): Promise<unknown> {
    try {
      const mutation = this.mutations.get(mutationId);
      if (!mutation) {
        throw new Error(`Mutation ${mutationId} not found`);
      }

      let finalData: unknown;

      switch (strategy) {
        case 'server_wins':
          finalData = serverData;
          break;

        case 'client_wins':
          finalData = mutation.mutatedData;
          break;

        case 'merge':
          // Smart merge: combine server + client, client wins on conflicts
          finalData = this.smartMerge(
            serverData as Record<string, unknown>,
            mutation.mutatedData as Record<string, unknown>
          );
          break;

        default:
          finalData = serverData;
      }

      mutation.mutatedData = finalData;
      await this.syncMutation(mutationId);

      this.logger.debug(
        `✅ Reconciled mutation ${mutationId} with strategy: ${strategy}`
      );

      return finalData;
    } catch (error) {
      this.logger.error(`❌ Failed to reconcile mutation`, error);
      throw error;
    }
  }

  /**
   * Smart merge of two objects
   * Client changes take precedence on field-by-field basis
   */
  private smartMerge(
    serverData: Record<string, unknown>,
    clientData: Record<string, unknown>
  ): Record<string, unknown> {
    const merged = { ...serverData };

    for (const [key, clientValue] of Object.entries(clientData)) {
      // Client changes always win
      merged[key] = clientValue;
    }

    return merged;
  }

  /**
   * Get all pending mutations
   */
  getPendingMutations(): MutationRecord[] {
    return Array.from(this.mutations.values()).filter(
      (m) => m.status === 'PENDING'
    );
  }

  /**
   * Get mutation by ID
   */
  getMutation(mutationId: string): MutationRecord | undefined {
    return this.mutations.get(mutationId);
  }

  /**
   * Get mutations by resource
   */
  getMutationsByResource(
    resourceType: string,
    resourceId?: string
  ): MutationRecord[] {
    return Array.from(this.mutations.values()).filter(
      (m) =>
        m.resourceType === resourceType &&
        (resourceId ? m.resourceId === resourceId : true)
    );
  }

  /**
   * Clear synced mutations
   */
  async clearSyncedMutations(): Promise<number> {
    try {
      const syncedMutations = Array.from(this.mutations.values()).filter(
        (m) => m.status === 'SYNCED'
      );

      const deletedCount = await this.cacheManager.clearSyncedMutations();

      for (const mutation of syncedMutations) {
        this.mutations.delete(mutation.id);
      }

      this.logger.log(`✅ Cleared ${deletedCount} synced mutations`);

      return deletedCount;
    } catch (error) {
      this.logger.error('❌ Failed to clear synced mutations', error);
      return 0;
    }
  }

  /**
   * Get mutation statistics
   */
  getStats(): {
    totalPending: number;
    totalSynced: number;
    totalFailed: number;
    mutations: MutationRecord[];
  } {
    const mutations = Array.from(this.mutations.values());

    return {
      totalPending: mutations.filter((m) => m.status === 'PENDING').length,
      totalSynced: mutations.filter((m) => m.status === 'SYNCED').length,
      totalFailed: mutations.filter((m) => m.status === 'FAILED').length,
      mutations,
    };
  }

  /**
   * Clear all mutations (use with caution)
   */
  async clear(): Promise<void> {
    this.mutations.clear();
    await this.cacheManager.clear();
    this.logger.log('✅ Mutations cleared');
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    this.mutations.clear();
    this.logger.debug('✅ Mutation tracker destroyed');
  }
}

// Singleton instance
let instance: MutationTracker | null = null;

/**
 * Get or create MutationTracker instance
 */
export async function getMutationTracker(): Promise<MutationTracker> {
  if (!instance) {
    instance = new MutationTracker();
    await instance.initialize();
  }
  return instance;
}

export default MutationTracker;
