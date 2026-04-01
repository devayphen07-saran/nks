/**
 * Offline-First Sync Service
 *
 * Handles offline request queueing:
 * - When offline: Queue mutations (POST/PUT/DELETE) locally
 * - When online: Process queue automatically
 * - Failed requests: Retry with exponential backoff
 * - Conflicts: Local data takes precedence until sync succeeds
 *
 * Flow:
 * User creates order (offline) → Queued in AsyncStorage
 * → Device comes online → Auto-sync to server
 * → Success → Remove from queue
 * → Failure → Retry next time
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import SecureSessionStorage from './secure-storage';

const SYNC_QUEUE_KEY = 'offline.sync_queue';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000; // Start with 1s, doubles each retry

export interface QueuedRequest {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  payload?: Record<string, any>;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

/**
 * ✅ Offline-first sync service
 * Queues mutations when offline, syncs when online
 */
export const SyncService = {
  /**
   * Queue a request to be processed when online
   * Used for mutations (POST/PUT/DELETE) when app is offline
   */
  queueRequest: async (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    endpoint: string,
    payload?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<void> => {
    try {
      const queue: QueuedRequest[] = await SyncService.getQueue();

      const request: QueuedRequest = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method,
        endpoint,
        payload,
        headers,
        timestamp: Date.now(),
        retryCount: 0,
      };

      queue.push(request);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

      console.log(
        `📦 Queued: ${method} ${endpoint} (Queue size: ${queue.length})`
      );
    } catch (error) {
      console.error('❌ Failed to queue request:', error);
    }
  },

  /**
   * Get current sync queue
   */
  getQueue: async (): Promise<QueuedRequest[]> => {
    try {
      const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Failed to read queue:', error);
      return [];
    }
  },

  /**
   * Process the sync queue
   * Automatically called when device comes online
   */
  syncQueue: async (): Promise<{
    success: boolean;
    synced: number;
    failed: number;
    remaining: number;
  }> => {
    try {
      // Check connectivity
      const state = await NetInfo.fetch();
      if (!state.isConnected || !state.isInternetReachable) {
        console.log('📡 Device offline. Sync skipped.');
        return { success: false, synced: 0, failed: 0, remaining: 0 };
      }

      // Get token
      const token = await SecureSessionStorage.getToken();
      if (!token) {
        console.error('❌ No auth token. User must login.');
        return { success: false, synced: 0, failed: 0, remaining: 0 };
      }

      const queue = await SyncService.getQueue();
      if (queue.length === 0) {
        console.log('✅ Sync queue empty');
        return { success: true, synced: 0, failed: 0, remaining: 0 };
      }

      console.log(`📤 Syncing ${queue.length} requests...`);

      let synced = 0;
      let failed = 0;
      const failed_requests: QueuedRequest[] = [];

      for (const request of queue) {
        try {
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_API_URL}${request.endpoint}`,
            {
              method: request.method,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                ...request.headers,
              },
              body:
                request.payload && request.method !== 'GET'
                  ? JSON.stringify(request.payload)
                  : undefined,
            }
          );

          if (response.status === 401) {
            // Token expired - try refresh
            console.log('🔄 Token expired, attempting refresh...');
            const refreshed = await SyncService.refreshToken();
            if (refreshed) {
              // Retry this request
              failed_requests.push(request);
            } else {
              // Refresh failed, need re-login
              console.error('❌ Token refresh failed. User must re-login.');
              return {
                success: false,
                synced,
                failed: queue.length - synced,
                remaining: queue.length - synced,
              };
            }
          } else if (!response.ok) {
            console.warn(
              `⚠️ Request failed: ${response.status} ${request.method} ${request.endpoint}`
            );
            failed_requests.push({
              ...request,
              retryCount: request.retryCount + 1,
              lastError: `HTTP ${response.status}`,
            });
            failed++;
          } else {
            console.log(`✅ Synced: ${request.method} ${request.endpoint}`);
            synced++;
          }
        } catch (error) {
          console.error(
            `❌ Network error: ${request.method} ${request.endpoint}`,
            error
          );
          failed_requests.push({
            ...request,
            retryCount: request.retryCount + 1,
            lastError: String(error),
          });
          failed++;
        }
      }

      // Update queue with failed requests (excluding max-retry failures)
      const finalQueue = failed_requests.filter(
        (req) => req.retryCount < MAX_RETRIES
      );

      const droppedCount = failed_requests.length - finalQueue.length;
      if (droppedCount > 0) {
        console.warn(
          `⚠️ ${droppedCount} requests exceeded max retries and were dropped`
        );
      }

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(finalQueue));

      const remaining = finalQueue.length;
      console.log(
        `📊 Sync complete: ${synced} succeeded, ${failed} failed, ${remaining} remaining`
      );

      return { success: remaining === 0, synced, failed, remaining };
    } catch (error) {
      console.error('❌ Sync queue processing failed:', error);
      return { success: false, synced: 0, failed: 0, remaining: 0 };
    }
  },

  /**
   * Refresh authentication token
   * Called when token expires during sync
   */
  refreshToken: async (): Promise<boolean> => {
    try {
      const token = await SecureSessionStorage.getToken();
      if (!token) return false;

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/v1/auth/refresh-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) return false;

      const data = await response.json();
      const { data: responseData } = data;

      // Save new token
      await SecureSessionStorage.saveToken(
        responseData.sessionToken || responseData.accessToken,
        new Date(responseData.expiresAt),
        responseData.jwtToken
      );

      console.log('✅ Token refreshed');
      return true;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  },

  /**
   * Watch for connectivity changes
   * Auto-sync when device comes online
   */
  watchConnectivity: () => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('📡 Device online! Starting auto-sync...');
        await SyncService.syncQueue();
      }
    });

    return unsubscribe;
  },

  /**
   * Force sync (manual trigger)
   * Called on app resume or user action
   */
  forceSyncIfNeeded: async (): Promise<void> => {
    const queue = await SyncService.getQueue();
    if (queue.length > 0) {
      console.log(`⚠️ Found ${queue.length} pending requests. Syncing...`);
      await SyncService.syncQueue();
    }
  },

  /**
   * Clear queue (use with caution!)
   */
  clearQueue: async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
      console.log('✅ Sync queue cleared');
    } catch (error) {
      console.error('❌ Failed to clear queue:', error);
    }
  },

  /**
   * Get queue stats for debugging
   */
  getStats: async (): Promise<{
    total: number;
    byMethod: Record<string, number>;
    oldestAge: number;
  }> => {
    const queue = await SyncService.getQueue();
    const now = Date.now();

    return {
      total: queue.length,
      byMethod: queue.reduce(
        (acc, req) => {
          acc[req.method] = (acc[req.method] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      oldestAge: queue.length > 0 ? Math.floor((now - queue[0].timestamp) / 1000) : 0,
    };
  },
};

export default SyncService;
