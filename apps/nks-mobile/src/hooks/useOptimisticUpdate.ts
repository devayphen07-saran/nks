/**
 * ✅ MODULE 7 PHASE 3: useOptimisticUpdate React Hook
 *
 * Purpose:
 * - Easy component integration with optimistic updates
 * - Show changes immediately in UI
 * - Handle sync and conflict resolution
 * - Provide rollback functionality
 *
 * Usage:
 * const { displayData, isPending, update, rollback } = useOptimisticUpdate(
 *   'products',
 *   '123',
 *   originalProduct
 * )
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Logger } from '@/utils/logger';
import { getOptimisticUpdateManager, ResolutionStrategy } from '@/services/sync/OptimisticUpdateManager';
import { getCacheManager } from '@/services/cache/CacheManager';
import { getMutationTracker } from '@/services/cache/MutationTracker';
import {
  updateApplied,
  updateSyncing,
  updateSynced,
  updateFailed,
  updateConflicted,
  resolveConflict,
  selectOptimisticUpdateById,
  selectHasConflicts,
} from '@/store/optimisticSlice';
import { cacheEntrySet } from '@/store/cacheSlice';

interface UseOptimisticUpdateOptions {
  onOptimistic?: (data: unknown) => void;
  onSync?: (data: unknown) => void;
  onError?: (error: Error) => void;
  onConflict?: (clientData: unknown, serverData: unknown) => void;
}

interface UseOptimisticUpdateResult<T> {
  displayData: T;
  isPending: boolean;
  isSyncing: boolean;
  hasConflict: boolean;
  update: (changes: Partial<T>, operation?: 'CREATE' | 'UPDATE' | 'DELETE') => Promise<string>;
  rollback: () => Promise<void>;
  resolve: (strategy: ResolutionStrategy) => Promise<void>;
}

const logger = new Logger('useOptimisticUpdate');

/**
 * Hook for optimistic updates with immediate UI feedback
 */
export function useOptimisticUpdate<T = unknown>(
  resourceType: string,
  resourceId: string,
  initialData: T,
  options: UseOptimisticUpdateOptions = {}
): UseOptimisticUpdateResult<T> {
  const dispatch = useDispatch();
  const [displayData, setDisplayData] = useState<T>(initialData);
  const [isPending, setIsPending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);

  const optimisticManagerRef = useRef(getOptimisticUpdateManager());
  const cacheManagerRef = useRef(getCacheManager());
  const mutationTrackerRef = useRef<Awaited<ReturnType<typeof getMutationTracker>> | null>(null);

  // Get optimistic update from Redux
  const optimisticUpdate = useSelector((state: any) =>
    currentUpdateId ? selectOptimisticUpdateById(currentUpdateId)(state) : null
  );

  // Initialize mutation tracker on mount
  useEffect(() => {
    getMutationTracker()
      .then((tracker: Awaited<ReturnType<typeof getMutationTracker>>) => {
        mutationTrackerRef.current = tracker;
      })
      .catch((err: unknown) => {
        logger.error('Failed to initialize mutation tracker', err);
      });
  }, []);

  /**
   * Apply optimistic update
   */
  const update = useCallback(
    async (
      changes: Partial<T>,
      operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE'
    ): Promise<string> => {
      try {
        setIsPending(true);
        setHasConflict(false);

        const optimisticManager = optimisticManagerRef.current;

        // Apply optimistic update
        const { optimisticId, updatedData } = await optimisticManager.applyOptimisticUpdate(
          resourceType,
          resourceId,
          changes,
          initialData
        );

        // Show updated data immediately
        setDisplayData(updatedData);
        setCurrentUpdateId(optimisticId);

        // Update cache
        const cacheManager = cacheManagerRef.current;
        await cacheManager.set(resourceType, updatedData, resourceId);

        // Track mutation
        const tracker = mutationTrackerRef.current;
        if (tracker) {
          await tracker.trackMutation(
            resourceType,
            operation,
            updatedData,
            initialData,
            resourceId
          );
        }

        // Dispatch Redux action
        dispatch(
          updateApplied({
            id: optimisticId,
            resourceType,
            resourceId,
            originalData: initialData,
            optimisticData: updatedData,
            changes: changes as Record<string, unknown>,
            timestamp: Date.now(),
            status: 'pending',
          })
        );

        // Update cache Redux
        dispatch(
          cacheEntrySet({
            resourceType,
            resourceId,
            data: updatedData,
          })
        );

        if (options.onOptimistic) {
          options.onOptimistic(updatedData);
        }

        logger.debug(`✅ Applied optimistic ${operation} for ${resourceType}:${resourceId}`);

        return optimisticId;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setIsPending(false);
        logger.error(`Failed to apply optimistic update`, error);
        if (options.onError) {
          options.onError(err);
        }
        throw error;
      } finally {
        setIsPending(false);
      }
    },
    [resourceType, resourceId, initialData, dispatch, options]
  );

  /**
   * Rollback optimistic update
   */
  const rollback = useCallback(async () => {
    try {
      if (!currentUpdateId) {
        return;
      }

      const optimisticManager = optimisticManagerRef.current;

      // Rollback to original
      const original = await optimisticManager.rollbackOptimisticUpdate(currentUpdateId);
      setDisplayData(original as T);
      setCurrentUpdateId(null);

      // Update cache
      const cacheManager = cacheManagerRef.current;
      await cacheManager.set(resourceType, original, resourceId);

      // Update Redux
      dispatch(
        cacheEntrySet({
          resourceType,
          resourceId,
          data: original,
        })
      );

      logger.debug(`✅ Rolled back optimistic update for ${resourceType}:${resourceId}`);
    } catch (error) {
      logger.error(`Failed to rollback optimistic update`, error);
    }
  }, [currentUpdateId, resourceType, resourceId, dispatch]);

  /**
   * Resolve conflict
   */
  const resolve = useCallback(
    async (strategy: ResolutionStrategy) => {
      try {
        if (!currentUpdateId) {
          return;
        }

        const optimisticManager = optimisticManagerRef.current;
        const update = optimisticManager.getOptimisticUpdate(currentUpdateId);

        if (!update) {
          return;
        }

        // Get server data from conflict
        const serverData = update.conflictData;
        if (!serverData) {
          return;
        }

        // Reconcile with selected strategy
        const finalData = await optimisticManager.reconcileOnSync(
          currentUpdateId,
          serverData,
          strategy
        );

        // Update display and cache
        setDisplayData(finalData as T);
        setHasConflict(false);

        const cacheManager = cacheManagerRef.current;
        await cacheManager.set(resourceType, finalData, resourceId);

        // Update Redux
        dispatch(
          resolveConflict({
            updateId: currentUpdateId,
            strategy,
          })
        );

        dispatch(
          cacheEntrySet({
            resourceType,
            resourceId,
            data: finalData,
          })
        );

        logger.debug(
          `✅ Resolved conflict with strategy: ${strategy}`
        );

        if (options.onSync) {
          options.onSync(finalData);
        }
      } catch (error) {
        logger.error(`Failed to resolve conflict`, error);
      }
    },
    [currentUpdateId, resourceType, resourceId, dispatch, options]
  );

  // Update display data when optimistic update changes
  useEffect(() => {
    if (optimisticUpdate) {
      setDisplayData(optimisticUpdate.optimisticData as T);
      setIsSyncing(optimisticUpdate.status === 'syncing');
      setHasConflict(optimisticUpdate.status === 'conflicted');
    }
  }, [optimisticUpdate]);

  return {
    displayData,
    isPending,
    isSyncing,
    hasConflict,
    update,
    rollback,
    resolve,
  };
}

/**
 * Hook to detect conflicts across multiple updates
 */
export function useOptimisticConflicts() {
  const conflicts = useSelector(selectHasConflicts);

  return {
    hasConflicts: conflicts,
  };
}

export default useOptimisticUpdate;
