/**
 * ✅ MODULE 7 PHASE 1: Optimistic Update Manager
 *
 * Purpose:
 * - Track optimistic updates (show change immediately in UI)
 * - Apply changes before sync confirmation
 * - Handle rollback on conflicts/failures
 * - Reconcile with server data on sync
 * - Manage conflict resolution strategies
 *
 * Flow:
 * 1. User makes change → apply optimistic update
 * 2. Show updated data in UI immediately
 * 3. Queue request for sync
 * 4. On sync: reconcile with server response
 * 5. If conflict: prompt user for resolution strategy
 */

import { Logger } from '@/utils/logger';

export type ResolutionStrategy = 'server_wins' | 'client_wins' | 'merge' | 'skip';

export interface OptimisticUpdate {
  id: string;
  resourceType: string;
  resourceId: string;
  originalData: unknown;
  optimisticData: unknown;
  changes: Record<string, unknown>;
  timestamp: number;
  queueRequestId?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflicted';
  conflictStrategy?: ResolutionStrategy;
  conflictData?: unknown; // Server version if conflict
  syncedAt?: number;
}

class OptimisticUpdateManager {
  private readonly logger = new Logger('OptimisticUpdateManager');
  private updates: Map<string, OptimisticUpdate> = new Map();
  private pendingUpdates: Map<string, OptimisticUpdate[]> = new Map();

  /**
   * Apply optimistic update
   */
  async applyOptimisticUpdate<T>(
    resourceType: string,
    resourceId: string,
    changes: Partial<T>,
    originalData: T
  ): Promise<{
    optimisticId: string;
    updatedData: T;
  }> {
    try {
      const optimisticId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Merge changes with original data
      const updatedData = {
        ...originalData,
        ...changes,
      } as T;

      const update: OptimisticUpdate = {
        id: optimisticId,
        resourceType,
        resourceId,
        originalData,
        optimisticData: updatedData,
        changes: changes as Record<string, unknown>,
        timestamp: Date.now(),
        status: 'pending',
      };

      this.updates.set(optimisticId, update);

      // Track by resource
      if (!this.pendingUpdates.has(resourceType)) {
        this.pendingUpdates.set(resourceType, []);
      }
      this.pendingUpdates.get(resourceType)!.push(update);

      this.logger.debug(
        `✅ Applied optimistic update for ${resourceType}:${resourceId}`
      );

      return {
        optimisticId,
        updatedData,
      };
    } catch (error) {
      this.logger.error(
        `❌ Failed to apply optimistic update`,
        error
      );
      throw error;
    }
  }

  /**
   * Rollback optimistic update (revert to original)
   */
  async rollbackOptimisticUpdate(optimisticId: string): Promise<unknown> {
    try {
      const update = this.updates.get(optimisticId);
      if (!update) {
        throw new Error(`Optimistic update ${optimisticId} not found`);
      }

      update.status = 'failed';

      // Remove from pending
      const pending = this.pendingUpdates.get(update.resourceType);
      if (pending) {
        const index = pending.findIndex((u) => u.id === optimisticId);
        if (index > -1) {
          pending.splice(index, 1);
        }
      }

      this.logger.debug(`✅ Rolled back optimistic update ${optimisticId}`);

      return update.originalData;
    } catch (error) {
      this.logger.error(`❌ Failed to rollback update`, error);
      throw error;
    }
  }

  /**
   * Mark update as syncing (in progress)
   */
  markSyncing(optimisticId: string): void {
    const update = this.updates.get(optimisticId);
    if (update) {
      update.status = 'syncing';
      this.logger.debug(`📤 Marked update ${optimisticId} as syncing`);
    }
  }

  /**
   * Reconcile optimistic update with server response
   */
  async reconcileOnSync(
    optimisticId: string,
    serverData: unknown,
    strategy: ResolutionStrategy = 'server_wins'
  ): Promise<unknown> {
    try {
      const update = this.updates.get(optimisticId);
      if (!update) {
        throw new Error(`Optimistic update ${optimisticId} not found`);
      }

      let finalData: unknown;

      switch (strategy) {
        case 'server_wins':
          // Server response is the source of truth
          finalData = serverData;
          this.logger.debug(`✅ Server won: using server data`);
          break;

        case 'client_wins':
          // Keep optimistic data (client always right)
          finalData = update.optimisticData;
          this.logger.debug(`✅ Client won: keeping optimistic data`);
          break;

        case 'merge':
          // Smart merge of both versions
          finalData = this.smartMerge(
            serverData as Record<string, unknown>,
            update.optimisticData as Record<string, unknown>
          );
          this.logger.debug(`✅ Merged both versions`);
          break;

        case 'skip':
          // Discard the optimistic update entirely
          finalData = update.originalData;
          this.logger.debug(`⏭️ Skipped update, reverted to original`);
          break;

        default:
          finalData = serverData;
      }

      update.optimisticData = finalData;
      update.conflictStrategy = strategy;
      update.status = 'synced';
      update.syncedAt = Date.now();

      // Remove from pending
      const pending = this.pendingUpdates.get(update.resourceType);
      if (pending) {
        const index = pending.findIndex((u) => u.id === optimisticId);
        if (index > -1) {
          pending.splice(index, 1);
        }
      }

      this.logger.debug(
        `✅ Reconciled optimistic update with strategy: ${strategy}`
      );

      return finalData;
    } catch (error) {
      this.logger.error(`❌ Failed to reconcile update`, error);
      throw error;
    }
  }

  /**
   * Detect conflict during sync
   */
  detectConflict(
    optimisticId: string,
    serverData: unknown
  ): {
    conflicted: boolean;
    clientData: unknown;
    serverData: unknown;
  } {
    const update = this.updates.get(optimisticId);
    if (!update) {
      return {
        conflicted: false,
        clientData: null,
        serverData: null,
      };
    }

    // Compare client vs server
    const conflicted = !this.deepEqual(
      update.optimisticData,
      serverData
    );

    if (conflicted) {
      update.conflictData = serverData;
      update.status = 'conflicted';

      this.logger.warn(
        `⚔️ Conflict detected for ${update.resourceType}:${update.resourceId}`
      );
    }

    return {
      conflicted,
      clientData: update.optimisticData,
      serverData,
    };
  }

  /**
   * Get optimistic update by ID
   */
  getOptimisticUpdate(optimisticId: string): OptimisticUpdate | undefined {
    return this.updates.get(optimisticId);
  }

  /**
   * Get all optimistic updates for a resource type
   */
  getUpdatesForResource(resourceType: string): OptimisticUpdate[] {
    return this.pendingUpdates.get(resourceType) || [];
  }

  /**
   * Get all conflicted updates
   */
  getConflictingUpdates(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(
      (u) => u.status === 'conflicted'
    );
  }

  /**
   * Get all pending updates
   */
  getPendingUpdates(): OptimisticUpdate[] {
    return Array.from(this.updates.values()).filter(
      (u) => u.status === 'pending' || u.status === 'syncing'
    );
  }

  /**
   * Get stats about optimistic updates
   */
  getStats(): {
    totalPending: number;
    totalConflicted: number;
    totalSynced: number;
    updates: OptimisticUpdate[];
  } {
    const updates = Array.from(this.updates.values());

    return {
      totalPending: updates.filter((u) => u.status === 'pending').length,
      totalConflicted: updates.filter((u) => u.status === 'conflicted').length,
      totalSynced: updates.filter((u) => u.status === 'synced').length,
      updates,
    };
  }

  /**
   * Smart merge of client and server data
   * Field-by-field comparison, client wins on conflicts
   */
  private smartMerge(
    serverData: Record<string, unknown>,
    clientData: Record<string, unknown>
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Start with server data
    Object.assign(merged, serverData);

    // Override with client changes
    for (const [key, clientValue] of Object.entries(clientData)) {
      merged[key] = clientValue;
    }

    return merged;
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;

      const aKeys = Object.keys(aObj);
      const bKeys = Object.keys(bObj);

      if (aKeys.length !== bKeys.length) return false;

      for (const key of aKeys) {
        if (!this.deepEqual(aObj[key], bObj[key])) {
          return false;
        }
      }

      return true;
    }

    return false;
  }

  /**
   * Link update to queue request
   */
  linkToQueueRequest(optimisticId: string, queueRequestId: string): void {
    const update = this.updates.get(optimisticId);
    if (update) {
      update.queueRequestId = queueRequestId;
      this.logger.debug(
        `✅ Linked optimistic update to queue request`
      );
    }
  }

  /**
   * Clear synced updates
   */
  clearSyncedUpdates(): number {
    const syncedIds = Array.from(this.updates.keys()).filter(
      (id) => this.updates.get(id)!.status === 'synced'
    );

    for (const id of syncedIds) {
      const update = this.updates.get(id)!;
      const pending = this.pendingUpdates.get(update.resourceType);
      if (pending) {
        const index = pending.findIndex((u) => u.id === id);
        if (index > -1) {
          pending.splice(index, 1);
        }
      }
      this.updates.delete(id);
    }

    this.logger.log(`✅ Cleared ${syncedIds.length} synced updates`);
    return syncedIds.length;
  }

  /**
   * Clear all updates (use with caution)
   */
  clear(): void {
    this.updates.clear();
    this.pendingUpdates.clear();
    this.logger.log('✅ All optimistic updates cleared');
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    this.updates.clear();
    this.pendingUpdates.clear();
    this.logger.debug('✅ Optimistic update manager destroyed');
  }
}

// Singleton instance
let instance: OptimisticUpdateManager | null = null;

/**
 * Get or create OptimisticUpdateManager instance
 */
export function getOptimisticUpdateManager(): OptimisticUpdateManager {
  if (!instance) {
    instance = new OptimisticUpdateManager();
  }
  return instance;
}

export default OptimisticUpdateManager;
