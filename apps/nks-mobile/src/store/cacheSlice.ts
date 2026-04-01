/**
 * ✅ MODULE 6 PHASE 5: Redux Cache Slice
 *
 * Purpose:
 * - Store cache state in Redux
 * - Track cache entries
 * - Monitor pending mutations
 * - Store cache statistics
 * - Enable UI updates based on cache state
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PendingMutation } from '@/database/sqlite.config';

export interface CacheStats {
  totalEntries: number;
  totalMutations: number;
  cachedResources: string[];
  lastCleanupAt: number | null;
}

export interface CacheSliceState {
  // Cache info
  entries: Record<string, unknown>;
  mutations: PendingMutation[];
  stats: CacheStats;

  // Status
  status: 'idle' | 'loading' | 'error';
  error: string | null;

  // Timestamps
  lastCacheUpdate: number | null;
  lastStatsSyncAt: number | null;
}

const initialState: CacheSliceState = {
  entries: {},
  mutations: [],
  stats: {
    totalEntries: 0,
    totalMutations: 0,
    cachedResources: [],
    lastCleanupAt: null,
  },
  status: 'idle',
  error: null,
  lastCacheUpdate: null,
  lastStatsSyncAt: null,
};

export const cacheSlice = createSlice({
  name: 'cache',
  initialState,
  reducers: {
    // Cache entry operations
    cacheEntrySet: (
      state,
      action: PayloadAction<{
        resourceType: string;
        resourceId?: string;
        data: unknown;
      }>
    ) => {
      const key = action.payload.resourceId
        ? `${action.payload.resourceType}:${action.payload.resourceId}`
        : action.payload.resourceType;
      state.entries[key] = action.payload.data;
      state.lastCacheUpdate = Date.now();
    },

    cacheEntryRemoved: (
      state,
      action: PayloadAction<{
        resourceType: string;
        resourceId?: string;
      }>
    ) => {
      const key = action.payload.resourceId
        ? `${action.payload.resourceType}:${action.payload.resourceId}`
        : action.payload.resourceType;
      delete state.entries[key];
      state.lastCacheUpdate = Date.now();
    },

    cacheEntriesCleared: (state) => {
      state.entries = {};
      state.lastCacheUpdate = Date.now();
    },

    // Mutation operations
    mutationRecorded: (state, action: PayloadAction<PendingMutation>) => {
      state.mutations.push(action.payload);
      state.stats.totalMutations = state.mutations.filter(
        (m) => m.status === 'PENDING'
      ).length;
    },

    mutationRemoved: (state, action: PayloadAction<string>) => {
      state.mutations = state.mutations.filter((m) => m.id !== action.payload);
      state.stats.totalMutations = state.mutations.filter(
        (m) => m.status === 'PENDING'
      ).length;
    },

    mutationSynced: (state, action: PayloadAction<string>) => {
      const mutation = state.mutations.find((m) => m.id === action.payload);
      if (mutation) {
        mutation.status = 'SYNCED';
        mutation.synced_at = Date.now();
        state.stats.totalMutations = state.mutations.filter(
          (m) => m.status === 'PENDING'
        ).length;
      }
    },

    mutationFailed: (state, action: PayloadAction<string>) => {
      const mutation = state.mutations.find((m) => m.id === action.payload);
      if (mutation) {
        mutation.status = 'FAILED';
        state.stats.totalMutations = state.mutations.filter(
          (m) => m.status === 'PENDING'
        ).length;
      }
    },

    mutationsCleared: (state) => {
      state.mutations = [];
      state.stats.totalMutations = 0;
    },

    // Statistics
    cacheStatsUpdated: (state, action: PayloadAction<CacheStats>) => {
      state.stats = action.payload;
      state.lastStatsSyncAt = Date.now();
    },

    // Status
    cacheLoading: (state) => {
      state.status = 'loading';
      state.error = null;
    },

    cacheError: (state, action: PayloadAction<string>) => {
      state.status = 'error';
      state.error = action.payload;
    },

    cacheIdle: (state) => {
      state.status = 'idle';
      state.error = null;
    },

    // Reset (on logout)
    resetCache: () => initialState,
  },
});

export const {
  cacheEntrySet,
  cacheEntryRemoved,
  cacheEntriesCleared,
  mutationRecorded,
  mutationRemoved,
  mutationSynced,
  mutationFailed,
  mutationsCleared,
  cacheStatsUpdated,
  cacheLoading,
  cacheError,
  cacheIdle,
  resetCache,
} = cacheSlice.actions;

export default cacheSlice.reducer;

// Selectors
export const selectCacheEntries = (state: { cache: CacheSliceState }) =>
  state.cache.entries;

export const selectCacheEntry =
  (resourceType: string, resourceId?: string) =>
  (state: { cache: CacheSliceState }) => {
    const key = resourceId
      ? `${resourceType}:${resourceId}`
      : resourceType;
    return state.cache.entries[key] ?? null;
  };

export const selectPendingMutations = (state: { cache: CacheSliceState }) =>
  state.cache.mutations.filter((m) => m.status === 'PENDING');

export const selectTotalMutations = (state: { cache: CacheSliceState }) =>
  state.cache.stats.totalMutations;

export const selectHasPendingMutations = (state: { cache: CacheSliceState }) =>
  state.cache.stats.totalMutations > 0;

export const selectCacheStatus = (state: { cache: CacheSliceState }) =>
  state.cache.status;

export const selectCacheError = (state: { cache: CacheSliceState }) =>
  state.cache.error;

export const selectCacheStats = (state: { cache: CacheSliceState }) =>
  state.cache.stats;

export const selectCachedResources = (state: { cache: CacheSliceState }) =>
  state.cache.stats.cachedResources;

export const selectLastCacheUpdate = (state: { cache: CacheSliceState }) =>
  state.cache.lastCacheUpdate;
