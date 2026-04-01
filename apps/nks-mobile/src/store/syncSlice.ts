import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { QueuedRequest } from '@/services/sync/RequestQueueManager';
import { SyncStats } from '@/services/sync/SyncCoordinator';

/**
 * ✅ MODULE 5 PHASE 5: Redux Sync Slice
 *
 * Purpose:
 * - Store sync state in Redux
 * - Track connection status
 * - Monitor queue size
 * - Store sync statistics
 * - Enable UI updates based on sync state
 *
 * State Structure:
 * - sync.state: Current state (OFFLINE/SYNCING/ONLINE)
 * - sync.isConnected: Network connection status
 * - sync.queueSize: Number of queued requests
 * - sync.syncInProgress: Whether sync is running
 * - sync.lastSyncAt: Timestamp of last successful sync
 * - sync.syncError: Last sync error message
 * - sync.stats: Statistics from last sync
 */

export interface SyncState {
  // State machine
  state: 'OFFLINE' | 'SYNCING' | 'ONLINE';
  isConnected: boolean;

  // Queue info
  queueSize: number;
  pendingRequests: QueuedRequest[];

  // Sync info
  lastSyncAt: number | null;
  syncInProgress: boolean;
  syncError: string | null;

  // Statistics
  stats: {
    totalQueued: number;
    totalSynced: number;
    totalFailed: number;
    conflictsFound: number;
    lastSyncDuration: number;
  };
}

const initialState: SyncState = {
  state: 'ONLINE',
  isConnected: true,
  queueSize: 0,
  pendingRequests: [],
  lastSyncAt: null,
  syncInProgress: false,
  syncError: null,
  stats: {
    totalQueued: 0,
    totalSynced: 0,
    totalFailed: 0,
    conflictsFound: 0,
    lastSyncDuration: 0,
  },
};

export const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    // Connection changes
    connectionChanged: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },

    // State machine transitions
    syncStateChanged: (state, action: PayloadAction<'OFFLINE' | 'SYNCING' | 'ONLINE'>) => {
      state.state = action.payload;
    },

    // Queue operations
    requestQueued: (state, action: PayloadAction<QueuedRequest>) => {
      state.queueSize++;
      state.pendingRequests.push(action.payload);
      state.stats.totalQueued++;
    },

    requestDequeued: (state, action: PayloadAction<string>) => {
      state.queueSize = Math.max(0, state.queueSize - 1);
      state.pendingRequests = state.pendingRequests.filter(
        (r) => r.id !== action.payload
      );
      state.stats.totalSynced++;
    },

    requestFailed: (state, action: PayloadAction<string>) => {
      state.stats.totalFailed++;
    },

    // Sync operations
    syncStarted: (state) => {
      state.syncInProgress = true;
      state.syncError = null;
    },

    syncCompleted: (state, action: PayloadAction<SyncStats>) => {
      state.syncInProgress = false;
      state.lastSyncAt = Date.now();
      state.syncError = null;
      state.stats.lastSyncDuration = action.payload.duration;
      state.stats.conflictsFound += action.payload.conflictsFound;
    },

    syncFailed: (state, action: PayloadAction<string>) => {
      state.syncInProgress = false;
      state.syncError = action.payload;
    },

    // Queue update
    updateQueueSize: (state, action: PayloadAction<number>) => {
      state.queueSize = action.payload;
    },

    // Clear error
    clearSyncError: (state) => {
      state.syncError = null;
    },

    // Reset state (on logout)
    resetSync: () => initialState,
  },
});

export const {
  connectionChanged,
  syncStateChanged,
  requestQueued,
  requestDequeued,
  requestFailed,
  syncStarted,
  syncCompleted,
  syncFailed,
  updateQueueSize,
  clearSyncError,
  resetSync,
} = syncSlice.actions;

export default syncSlice.reducer;

// Selectors
export const selectSyncState = (state: { sync: SyncState }) => state.sync.state;
export const selectIsConnected = (state: { sync: SyncState }) => state.sync.isConnected;
export const selectQueueSize = (state: { sync: SyncState }) => state.sync.queueSize;
export const selectSyncInProgress = (state: { sync: SyncState }) => state.sync.syncInProgress;
export const selectLastSyncAt = (state: { sync: SyncState }) => state.sync.lastSyncAt;
export const selectSyncError = (state: { sync: SyncState }) => state.sync.syncError;
export const selectSyncStats = (state: { sync: SyncState }) => state.sync.stats;

// Derived selectors
export const selectIsOffline = (state: { sync: SyncState }) => state.sync.state === 'OFFLINE';
export const selectIsSyncing = (state: { sync: SyncState }) => state.sync.state === 'SYNCING';
export const selectIsOnline = (state: { sync: SyncState }) => state.sync.state === 'ONLINE';
export const selectHasPendingRequests = (state: { sync: SyncState }) =>
  state.sync.queueSize > 0;
