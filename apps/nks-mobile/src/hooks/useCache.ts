/**
 * ✅ MODULE 6 PHASE 6: useCache React Hook
 *
 * Purpose:
 * - Easy component integration with cache system
 * - Provides cached data to components
 * - Handles loading and error states
 * - Supports manual refetch and invalidation
 *
 * Usage:
 * const { data, isCached, isLoading, error } = useCache('products', { resourceId: '123' })
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Logger } from '@/utils/logger';
import { getCacheManager, CachePolicy } from '@/services/cache/CacheManager';
import { getMutationTracker } from '@/services/cache/MutationTracker';
import {
  cacheEntrySet,
  cacheEntryRemoved,
  cacheLoading,
  cacheError,
  cacheIdle,
  selectCacheEntry,
} from '@/store/cacheSlice';
import { selectSyncState } from '@/store/syncSlice';

interface UseCacheOptions {
  resourceId?: string;
  skipCache?: boolean;
  onlineOnly?: boolean;
  ttl?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: unknown) => void;
}

interface UseCacheResult<T> {
  data: T | null;
  isLoading: boolean;
  isCached: boolean;
  isStale: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => Promise<void>;
  isSyncing: boolean;
}

const logger = new Logger('useCache');

/**
 * Hook to access cached data with automatic updates
 */
export function useCache<T = unknown>(
  resourceType: string,
  options: UseCacheOptions = {}
): UseCacheResult<T> {
  const dispatch = useDispatch();
  const syncState = useSelector(selectSyncState);
  const cachedEntry = useSelector(selectCacheEntry(resourceType, options.resourceId));

  const [isLoading, setIsLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheManagerRef = useRef(getCacheManager());
  const mutationTrackerRef = useRef<Awaited<ReturnType<typeof getMutationTracker>> | null>(null);

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
   * Load data from cache
   */
  const loadFromCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const cacheManager = cacheManagerRef.current;
      const data = await cacheManager.get<T>(resourceType, options.resourceId);

      if (data) {
        setIsCached(true);

        // Check if stale
        const isFresh = await cacheManager.isCacheFresh(resourceType);
        setIsStale(!isFresh);

        // Update Redux
        dispatch(
          cacheEntrySet({
            resourceType,
            resourceId: options.resourceId,
            data,
          })
        );

        if (options.onSuccess) {
          options.onSuccess(data);
        }

        logger.debug(`✅ Loaded ${resourceType} from cache`);
      } else {
        setIsCached(false);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      logger.error(`Failed to load ${resourceType} from cache`, err);
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [resourceType, options, dispatch]);

  /**
   * Refetch data
   */
  const refetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await loadFromCache();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadFromCache, options]);

  /**
   * Invalidate cache entry
   */
  const invalidate = useCallback(async () => {
    try {
      const cacheManager = cacheManagerRef.current;
      await cacheManager.invalidate(resourceType, options.resourceId);

      dispatch(
        cacheEntryRemoved({
          resourceType,
          resourceId: options.resourceId,
        })
      );

      setIsCached(false);
      setIsStale(true);

      logger.debug(`✅ Invalidated ${resourceType} cache`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      logger.error(`Failed to invalidate ${resourceType}`, err);
    }
  }, [resourceType, options, dispatch]);

  /**
   * Initial load on mount
   */
  useEffect(() => {
    // Skip cache if offline-only and currently offline
    if (options.onlineOnly && syncState === 'OFFLINE') {
      logger.debug(
        `⏭️ Skipping cache load for ${resourceType} (offline-only, currently offline)`
      );
      return;
    }

    // Skip if explicitly disabled
    if (options.skipCache) {
      logger.debug(
        `⏭️ Skipping cache load for ${resourceType} (skipCache enabled)`
      );
      return;
    }

    loadFromCache();
  }, [resourceType, options.resourceId, options.onlineOnly, syncState, options.skipCache, loadFromCache]);

  /**
   * Check for pending mutations
   */
  const hasPendingMutations = useCallback((): boolean => {
    if (!mutationTrackerRef.current) {
      return false;
    }

    const mutations = mutationTrackerRef.current.getMutationsByResource(
      resourceType,
      options.resourceId
    );

    return mutations.some((m: any) => m.status === 'PENDING');
  }, [resourceType, options.resourceId]);

  return {
    data: (cachedEntry as T) ?? null,
    isLoading,
    isCached,
    isStale,
    error,
    refetch,
    invalidate,
    isSyncing: hasPendingMutations(),
  };
}

/**
 * Hook to track and apply optimistic updates
 */
export function useCacheMutation<T = unknown>(
  resourceType: string,
  resourceId: string,
  initialData: T,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [optimisticData, setOptimisticData] = useState<T>(initialData);
  const mutationTrackerRef = useRef<Awaited<ReturnType<typeof getMutationTracker>> | null>(null);
  const cacheManagerRef = useRef(getCacheManager());

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
   * Apply mutation with optimistic update
   */
  const mutate = useCallback(
    async (changes: Partial<T>, operation: 'CREATE' | 'UPDATE' | 'DELETE' = 'UPDATE') => {
      try {
        setIsLoading(true);
        setError(null);

        // Apply optimistic update
        const optimistic = {
          ...initialData,
          ...changes,
        };
        setOptimisticData(optimistic);

        // Track mutation
        const tracker = mutationTrackerRef.current;
        if (tracker) {
          const mutation = await tracker.trackMutation(
            resourceType,
            operation,
            optimistic,
            initialData,
            resourceId
          );

          // Update cache
          const cacheManager = cacheManagerRef.current;
          await cacheManager.set(resourceType, optimistic, resourceId);

          // Update Redux
          dispatch(
            cacheEntrySet({
              resourceType,
              resourceId,
              data: optimistic,
            })
          );

          logger.debug(`✅ Applied optimistic ${operation} for ${resourceType}:${resourceId}`);

          if (options.onSuccess) {
            options.onSuccess(optimistic);
          }

          return mutation;
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        // Rollback optimistic update
        setOptimisticData(initialData);
        logger.error(`Failed to apply mutation`, err);
        if (options.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [resourceType, resourceId, initialData, dispatch, options]
  );

  /**
   * Rollback optimistic update
   */
  const rollback = useCallback(async () => {
    try {
      setOptimisticData(initialData);

      // Update cache
      const cacheManager = cacheManagerRef.current;
      await cacheManager.set(resourceType, initialData, resourceId);

      // Update Redux
      dispatch(
        cacheEntrySet({
          resourceType,
          resourceId,
          data: initialData,
        })
      );

      logger.debug(`✅ Rolled back mutation for ${resourceType}:${resourceId}`);
    } catch (err) {
      logger.error(`Failed to rollback mutation`, err);
    }
  }, [resourceType, resourceId, initialData, dispatch]);

  return {
    mutate,
    rollback,
    isLoading,
    error,
    optimisticData,
  };
}

export default useCache;
