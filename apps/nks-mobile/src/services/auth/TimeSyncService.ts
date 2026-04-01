import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '@/utils/logger';

/**
 * ✅ MODULE 4: Time Sync Service
 *
 * Purpose:
 * - Detect and handle device time offset
 * - Calculate difference between device time and server time
 * - Use offset to accurately validate token expiry
 * - Alert user if device time is severely wrong (>5min)
 *
 * Why this matters:
 * - Devices can have incorrect clocks
 * - Token expiry uses Unix timestamp (seconds since epoch)
 * - Wrong device time breaks token validation
 * - Solution: Calculate offset and use it for all time comparisons
 */

interface TimeSyncState {
  offset: number;           // Seconds (server_time - device_time)
  lastSyncAt: number;       // Timestamp (ms) when last synced
  lastSyncDeviceTime: number; // Device time at last sync
  isSynced: boolean;        // Whether we have a valid offset
}

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // Re-sync every 1 hour
const SEVERE_SKEW_THRESHOLD_SEC = 5 * 60; // >5 minutes is severe
const STORAGE_KEY = 'time_sync_state';

export class TimeSyncService {
  private static readonly logger = new Logger('TimeSyncService');
  private api: any; // Will be injected
  private syncState: TimeSyncState | null = null;

  constructor(api: any) {
    this.api = api;
  }

  /**
   * Initialize time sync (call on app startup)
   */
  async initialize(): Promise<void> {
    try {
      // Load previous sync state from storage
      this.syncState = await this.loadSyncState();

      // Check if we need to re-sync
      if (this.needsResync()) {
        await this.syncTime();
      } else if (this.syncState) {
        this.logger.debug(
          `⏱️ Using cached time offset: ${this.syncState.offset}s`
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize time sync', error);
      // Continue without offset (will use device time)
    }
  }

  /**
   * Sync device time with server
   */
  async syncTime(): Promise<{ offset: number; deviceTime: number }> {
    try {
      const deviceTime = Math.floor(Date.now() / 1000); // seconds

      this.logger.debug('📡 Syncing time with backend...');

      const response = await this.api.post('/auth/sync-time', {
        deviceTime,
      });

      const { serverTime, offset } = response.data.data;

      // Save sync state
      this.syncState = {
        offset,
        lastSyncAt: Date.now(),
        lastSyncDeviceTime: deviceTime,
        isSynced: true,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.syncState));

      // Alert if severe skew
      if (Math.abs(offset) > SEVERE_SKEW_THRESHOLD_SEC) {
        this.logger.warn(
          `⚠️ Device time is ${Math.abs(offset)}s off from server (severe skew)`
        );
      } else {
        this.logger.debug(
          `✅ Time synced. Device offset: ${offset}s (${offset > 0 ? 'ahead' : 'behind'})`
        );
      }

      return { offset, deviceTime };
    } catch (error) {
      this.logger.error('Failed to sync time with backend', error);
      // Continue with existing offset or device time
      throw new Error('Time sync failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Get current time adjusted for device offset
   * Returns: seconds since epoch (adjusted)
   */
  getCurrentTime(): number {
    const deviceTime = Math.floor(Date.now() / 1000);
    const offset = this.syncState?.offset || 0;
    return deviceTime + offset;
  }

  /**
   * Get current time offset in seconds
   */
  getTimeOffset(): number {
    return this.syncState?.offset || 0;
  }

  /**
   * Check if device is severely out of sync (>5 minutes)
   */
  isSeverelyOutOfSync(): boolean {
    if (!this.syncState) return false;
    return Math.abs(this.syncState.offset) > SEVERE_SKEW_THRESHOLD_SEC;
  }

  /**
   * Get sync state metadata
   */
  getSyncState(): TimeSyncState | null {
    return this.syncState;
  }

  /**
   * Check if time sync is needed
   */
  private needsResync(): boolean {
    if (!this.syncState || !this.syncState.isSynced) {
      return true; // Never synced
    }

    const timeSinceSync = Date.now() - this.syncState.lastSyncAt;
    return timeSinceSync > SYNC_INTERVAL_MS;
  }

  /**
   * Load sync state from storage
   */
  private async loadSyncState(): Promise<TimeSyncState | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      this.logger.error('Failed to load sync state from storage', error);
      return null;
    }
  }

  /**
   * Clear sync state (on logout)
   */
  async clearSyncState(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      this.syncState = null;
      this.logger.debug('✅ Time sync state cleared');
    } catch (error) {
      this.logger.error('Failed to clear sync state', error);
    }
  }

  /**
   * Force re-sync (call when coming online)
   */
  async forceSyncTime(): Promise<{ offset: number; deviceTime: number }> {
    this.logger.debug('🔄 Forcing time re-sync...');
    return await this.syncTime();
  }

  /**
   * Calculate seconds until a given Unix timestamp (adjusted for offset)
   */
  secondsUntil(expiryTimestamp: number): number {
    return expiryTimestamp - this.getCurrentTime();
  }

  /**
   * Check if a timestamp is in the past (adjusted for offset)
   */
  isExpired(expiryTimestamp: number): boolean {
    return expiryTimestamp < this.getCurrentTime();
  }

  /**
   * Check if expiry is close (within N seconds)
   */
  isExpiringWithin(expiryTimestamp: number, secondsBuffer: number = 60): boolean {
    const secondsUntilExpiry = this.secondsUntil(expiryTimestamp);
    return secondsUntilExpiry < secondsBuffer && secondsUntilExpiry > 0;
  }
}
