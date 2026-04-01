import { useNetInfo } from '@react-native-community/netinfo';
import { Logger } from '@/utils/logger';

/**
 * ✅ MODULE 5 PHASE 1: Connectivity Monitor
 *
 * Purpose:
 * - Detect network state changes (online ↔ offline)
 * - Provide network type information (WiFi, cellular, none)
 * - Trigger state machine transitions
 * - Subscribe to connection changes
 *
 * Usage:
 * - Initialize on app launch
 * - Subscribe to onConnectionChange for UI updates
 * - Check isOnline() before API calls
 */

type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown';

export class ConnectivityMonitor {
  private static readonly logger = new Logger('ConnectivityMonitor');
  private isOnlineState = true;
  private networkType: NetworkType = 'unknown';
  private listeners: Array<(isOnline: boolean) => void> = [];
  private unsubscribe: (() => void) | null = null;

  /**
   * Initialize connectivity monitoring
   * Call once on app startup
   */
  async initialize(): Promise<void> {
    try {
      this.logger.debug('📡 Initializing connectivity monitor...');

      // Get current network state
      // Note: This uses the hook, but for initialization we'll use direct approach
      // In real implementation, integrate with react-native-netinfo
      await this.checkConnection();

      this.logger.debug(
        `✅ Connectivity monitor initialized. Current: ${this.isOnlineState ? 'ONLINE' : 'OFFLINE'}`
      );
    } catch (error) {
      this.logger.error('Failed to initialize connectivity monitor', error);
      // Assume online if check fails
      this.isOnlineState = true;
    }
  }

  /**
   * Check current network connection
   * Returns true if device has internet
   */
  async checkConnection(): Promise<boolean> {
    try {
      // In production, use react-native-netinfo:
      // const state = await NetInfo.fetch()
      // this.isOnlineState = state.isConnected ?? false
      // this.networkType = this.mapNetworkType(state.type)

      // For now, simulated implementation:
      // You would import and use:
      // import { fetchNetworkState } from '@react-native-community/netinfo'
      // const state = await fetchNetworkState()

      this.logger.debug(
        `📊 Network check: ${this.isOnlineState ? 'ONLINE' : 'OFFLINE'} (${this.networkType})`
      );
      return this.isOnlineState;
    } catch (error) {
      this.logger.error('Network check failed', error);
      return this.isOnlineState;
    }
  }

  /**
   * Subscribe to connection changes
   * Returns unsubscribe function
   */
  onConnectionChange(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Get current online status
   */
  isOnline(): boolean {
    return this.isOnlineState;
  }

  /**
   * Get current network type
   */
  getNetworkType(): NetworkType {
    return this.networkType;
  }

  /**
   * Get detailed connection info
   */
  getConnectionInfo(): {
    isOnline: boolean;
    networkType: NetworkType;
    checkedAt: number;
  } {
    return {
      isOnline: this.isOnlineState,
      networkType: this.networkType,
      checkedAt: Date.now(),
    };
  }

  /**
   * Handle connection state change
   * Called internally when network changes
   */
  private handleConnectionChange(isOnline: boolean): void {
    const wasOnline = this.isOnlineState;
    this.isOnlineState = isOnline;

    // Log transition
    if (wasOnline && !isOnline) {
      this.logger.warn('🔴 Network transition: ONLINE → OFFLINE');
    } else if (!wasOnline && isOnline) {
      this.logger.log('🟢 Network transition: OFFLINE → ONLINE');
    }

    // Notify all subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(isOnline);
      } catch (error) {
        this.logger.error('Error in connection change listener', error);
      }
    });
  }

  /**
   * Map NetInfo type to our types
   */
  private mapNetworkType(
    netinfoType: string
  ): NetworkType {
    switch (netinfoType) {
      case 'wifi':
      case 'ethernet':
        return 'wifi';
      case 'cellular':
      case '2g':
      case '3g':
      case '4g':
      case '5g':
        return 'cellular';
      case 'none':
      case 'unknown':
      case 'bluetooth':
      default:
        return 'unknown';
    }
  }

  /**
   * Force refresh network state
   * Useful after resuming from background
   */
  async forceRefresh(): Promise<boolean> {
    this.logger.debug('🔄 Force refreshing network state...');
    return await this.checkConnection();
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
    this.logger.debug('✅ Connectivity monitor destroyed');
  }

  /**
   * Setup actual NetInfo listener (call after initialize)
   * This would be called in a separate setup function
   */
  setupNetInfoListener(): void {
    // Example implementation using react-native-community/netinfo
    // In production code, you would do:
    //
    // import { subscribe } from '@react-native-community/netinfo'
    //
    // this.unsubscribe = subscribe(state => {
    //   this.networkType = this.mapNetworkType(state.type)
    //   this.handleConnectionChange(state.isConnected ?? false)
    // })
    //
    // For now, this is a placeholder
    this.logger.debug('📡 NetInfo listener setup (placeholder)');
  }

  /**
   * Simulate network change (for testing)
   */
  simulateNetworkChange(isOnline: boolean): void {
    this.logger.warn(`⚠️ SIMULATING network change: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    this.handleConnectionChange(isOnline);
  }
}
