import { Logger } from '@/utils/logger';
import { ConnectivityMonitor } from './ConnectivityMonitor';
import { RequestQueueManager } from './RequestQueueManager';

/**
 * ✅ MODULE 5 PHASE 3: Sync State Machine
 *
 * Purpose:
 * - Manage three states: OFFLINE, SYNCING, ONLINE
 * - Coordinate state transitions
 * - Emit state change events
 * - Handle edge cases (rapid transitions, etc)
 *
 * State Flow:
 * OFFLINE → (connection restored) → SYNCING
 * SYNCING → (queue empty) → ONLINE
 * ONLINE → (connection lost) → OFFLINE
 *
 * Usage:
 * - Subscribe to state changes
 * - Check current state before operations
 * - Trigger sync when transitioning to SYNCING
 */

export type SyncState = 'OFFLINE' | 'SYNCING' | 'ONLINE';

export interface SyncContext {
  currentState: SyncState;
  isConnected: boolean;
  lastSyncAt: number | null;
  pendingRequests: number;
  syncError: string | null;
  isTransitioning: boolean;
}

export class SyncStateMachine {
  private static readonly logger = new Logger('SyncStateMachine');
  private currentState: SyncState = 'ONLINE';
  private lastSyncAt: number | null = null;
  private syncError: string | null = null;
  private isTransitioning = false;
  private listeners: Array<(state: SyncState) => void> = [];
  private unsubscribeConnectivity: (() => void) | null = null;

  constructor(
    private connectivityMonitor: ConnectivityMonitor,
    private requestQueueManager: RequestQueueManager
  ) {
    // Initialize with current network state
    if (connectivityMonitor.isOnline()) {
      this.currentState = 'ONLINE';
    } else {
      this.currentState = 'OFFLINE';
    }
  }

  /**
   * Initialize state machine
   */
  async initialize(): Promise<void> {
    try {
      this.logger.debug(`✅ Sync state machine initialized. Initial state: ${this.currentState}`);

      // Subscribe to connectivity changes
      this.unsubscribeConnectivity = this.connectivityMonitor.onConnectionChange(
        (isOnline) => {
          this.handleConnectivityChange(isOnline);
        }
      );

      this.logger.debug('📡 Connected to connectivity monitor');
    } catch (error) {
      this.logger.error('Failed to initialize state machine', error);
    }
  }

  /**
   * Get current state
   */
  getState(): SyncState {
    return this.currentState;
  }

  /**
   * Get full context info
   */
  getContext(): SyncContext {
    return {
      currentState: this.currentState,
      isConnected: this.connectivityMonitor.isOnline(),
      lastSyncAt: this.lastSyncAt,
      pendingRequests: this.requestQueueManager.getSize(),
      syncError: this.syncError,
      isTransitioning: this.isTransitioning,
    };
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  onStateChange(callback: (state: SyncState) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Check if state allows immediate request execution
   * true = ONLINE or SYNCING (process requests)
   * false = OFFLINE (queue requests)
   */
  canExecuteRequest(): boolean {
    return this.currentState === 'ONLINE' || this.currentState === 'SYNCING';
  }

  /**
   * Check if request should be queued
   * true = OFFLINE (queue requests)
   * false = ONLINE or SYNCING (execute immediately)
   */
  shouldQueueRequest(): boolean {
    return this.currentState === 'OFFLINE';
  }

  /**
   * Trigger sync (call when entering SYNCING state)
   */
  async triggerSync(): Promise<void> {
    if (this.currentState !== 'SYNCING') {
      this.logger.warn(`⚠️ Cannot trigger sync in ${this.currentState} state`);
      return;
    }

    this.logger.debug('🔄 Sync triggered');
    // Actual sync logic handled by SyncCoordinator
    // This just signals that sync can start
  }

  /**
   * Signal sync completion
   * Call this when all queued requests processed
   */
  async signalSyncComplete(): Promise<void> {
    if (this.currentState === 'SYNCING') {
      await this.transitionToOnline();
    }
  }

  /**
   * Signal sync error
   */
  async signalSyncError(error: string): Promise<void> {
    this.syncError = error;
    this.logger.error(`❌ Sync error: ${error}`);

    // If we were syncing and error occurred, go back to offline
    if (this.currentState === 'SYNCING' && !this.connectivityMonitor.isOnline()) {
      await this.transitionToOffline();
    }
  }

  /**
   * Handle connectivity change
   */
  private async handleConnectivityChange(isOnline: boolean): Promise<void> {
    if (isOnline && this.currentState === 'OFFLINE') {
      // Connection restored
      await this.transitionToSyncing();
    } else if (!isOnline && (this.currentState === 'ONLINE' || this.currentState === 'SYNCING')) {
      // Connection lost
      await this.transitionToOffline();
    }
  }

  /**
   * Transition to OFFLINE state
   */
  private async transitionToOffline(): Promise<void> {
    if (this.currentState === 'OFFLINE' || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    try {
      this.logger.log('🔴 State transition: → OFFLINE');
      const previousState = this.currentState;
      this.currentState = 'OFFLINE';
      this.syncError = null;

      // Emit state change
      this.emitStateChange();

      this.logger.log(`✅ Transitioned from ${previousState} to OFFLINE`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Transition to SYNCING state
   */
  private async transitionToSyncing(): Promise<void> {
    if (this.currentState === 'SYNCING' || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    try {
      this.logger.log('🟡 State transition: → SYNCING');
      const previousState = this.currentState;
      this.currentState = 'SYNCING';
      this.syncError = null;

      // Emit state change
      this.emitStateChange();

      this.logger.log(`✅ Transitioned from ${previousState} to SYNCING`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Transition to ONLINE state
   */
  private async transitionToOnline(): Promise<void> {
    if (this.currentState === 'ONLINE' || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    try {
      this.logger.log('🟢 State transition: → ONLINE');
      const previousState = this.currentState;
      this.currentState = 'ONLINE';
      this.lastSyncAt = Date.now();
      this.syncError = null;

      // Emit state change
      this.emitStateChange();

      this.logger.log(`✅ Transitioned from ${previousState} to ONLINE`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Emit state change to all listeners
   */
  private emitStateChange(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState);
      } catch (error) {
        this.logger.error('Error in state change listener', error);
      }
    });
  }

  /**
   * Force state transition (for testing/recovery)
   */
  async forceStateTransition(newState: SyncState): Promise<void> {
    this.logger.warn(`⚠️ FORCING state transition: ${this.currentState} → ${newState}`);

    if (newState === 'OFFLINE') {
      await this.transitionToOffline();
    } else if (newState === 'SYNCING') {
      await this.transitionToSyncing();
    } else if (newState === 'ONLINE') {
      await this.transitionToOnline();
    }
  }

  /**
   * Get state machine info for debugging
   */
  getDebugInfo(): {
    state: SyncState;
    context: SyncContext;
    isConnected: boolean;
    connectionInfo: ReturnType<typeof this.connectivityMonitor.getConnectionInfo>;
    queueSize: number;
  } {
    return {
      state: this.currentState,
      context: this.getContext(),
      isConnected: this.connectivityMonitor.isOnline(),
      connectionInfo: this.connectivityMonitor.getConnectionInfo(),
      queueSize: this.requestQueueManager.getSize(),
    };
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    if (this.unsubscribeConnectivity) {
      this.unsubscribeConnectivity();
      this.unsubscribeConnectivity = null;
    }
    this.listeners = [];
    this.logger.debug('✅ Sync state machine destroyed');
  }
}
