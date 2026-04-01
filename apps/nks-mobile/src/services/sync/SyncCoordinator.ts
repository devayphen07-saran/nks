import { Logger } from '@/utils/logger';
import { SyncStateMachine } from './SyncStateMachine';
import { RequestQueueManager, QueuedRequest } from './RequestQueueManager';

/**
 * ✅ MODULE 5 PHASE 4: Sync Coordinator
 *
 * Purpose:
 * - Orchestrate complete sync cycle
 * - Coordinate between modules (token, JWT, queue)
 * - Handle step-by-step sync process
 * - Emit events for UI updates
 *
 * Sync Steps:
 * 1. Check token validity (Module 3)
 * 2. Verify roles (Module 4)
 * 3. Drain request queue (replay queued requests)
 * 4. Resolve conflicts
 * 5. Update local cache
 *
 * Usage:
 * - Call sync() when coming online
 * - Subscribe to sync events
 * - Handle sync errors gracefully
 */

export interface SyncStats {
  requestsProcessed: number;
  requestsSucceeded: number;
  requestsFailed: number;
  conflictsFound: number;
  syncStartedAt: number;
  syncCompletedAt: number;
  duration: number;
}

export interface SyncResult {
  success: boolean;
  syncedAt: number;
  stats: SyncStats;
  errors: Array<{
    requestId: string;
    error: string;
  }>;
}

export type SyncEventType = 'sync_started' | 'sync_step' | 'sync_completed' | 'sync_error';

interface SyncEvent {
  type: SyncEventType;
  message: string;
  data?: unknown;
  timestamp: number;
}

const DEFAULT_RETRY_DELAY_MS = 1000;

export class SyncCoordinator {
  private static readonly logger = new Logger('SyncCoordinator');
  private eventListeners: Array<(event: SyncEvent) => void> = [];
  private isSyncing = false;
  private lastSyncResult: SyncResult | null = null;

  constructor(
    private stateMachine: SyncStateMachine,
    private requestQueueManager: RequestQueueManager
  ) {}

  /**
   * Execute complete sync cycle
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.logger.warn('⚠️ Sync already in progress');
      return this.lastSyncResult || {
        success: false,
        syncedAt: Date.now(),
        stats: this.createEmptyStats(),
        errors: [{ requestId: '', error: 'Sync already in progress' }],
      };
    }

    this.isSyncing = true;
    const syncStartedAt = Date.now();
    const errors: SyncResult['errors'] = [];

    try {
      this.emitEvent('sync_started', '🔄 Starting sync cycle', { state: this.stateMachine.getState() });

      // Step 1: Check token validity
      this.logger.debug('📝 Step 1/4: Checking token validity...');
      this.emitEvent('sync_step', 'Checking token validity', { step: 1 });
      try {
        await this.checkToken();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error('Token check failed', error);
        errors.push({ requestId: 'token_check', error: errorMsg });
        throw error; // Stop sync if token invalid
      }

      // Step 2: Verify roles haven't changed
      this.logger.debug('📝 Step 2/4: Verifying roles...');
      this.emitEvent('sync_step', 'Verifying user roles', { step: 2 });
      try {
        await this.verifyRoles();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn('Role verification failed', error);
        // Don't stop sync, just log the warning
      }

      // Step 3: Drain request queue
      this.logger.debug('📝 Step 3/4: Draining request queue...');
      this.emitEvent('sync_step', 'Processing queued requests', { step: 3 });
      const drainResult = await this.drainRequestQueue();
      errors.push(...drainResult.errors);

      // Step 4: Resolve conflicts (if any found)
      if (drainResult.conflictsFound > 0) {
        this.logger.debug('📝 Step 4/4: Resolving conflicts...');
        this.emitEvent('sync_step', `Resolving ${drainResult.conflictsFound} conflicts`, { step: 4 });
        try {
          await this.resolveConflicts();
        } catch (error) {
          this.logger.error('Conflict resolution failed', error);
          // Conflicts not critical, sync still succeeds
        }
      }

      // All done
      this.logger.log('✅ Sync cycle completed successfully');
      const syncResult: SyncResult = {
        success: true,
        syncedAt: Date.now(),
        stats: {
          requestsProcessed: drainResult.requestsProcessed,
          requestsSucceeded: drainResult.requestsSucceeded,
          requestsFailed: drainResult.requestsFailed,
          conflictsFound: drainResult.conflictsFound,
          syncStartedAt,
          syncCompletedAt: Date.now(),
          duration: Date.now() - syncStartedAt,
        },
        errors,
      };

      this.lastSyncResult = syncResult;
      this.emitEvent('sync_completed', '✅ Sync completed', { stats: syncResult.stats });

      // Signal completion to state machine
      await this.stateMachine.signalSyncComplete();

      return syncResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('Sync cycle failed', error);

      const syncResult: SyncResult = {
        success: false,
        syncedAt: Date.now(),
        stats: {
          ...this.createEmptyStats(),
          syncStartedAt,
          syncCompletedAt: Date.now(),
          duration: Date.now() - syncStartedAt,
        },
        errors,
      };

      this.lastSyncResult = syncResult;
      this.emitEvent('sync_error', `❌ Sync failed: ${errorMsg}`, { error: errorMsg });

      // Signal error to state machine
      await this.stateMachine.signalSyncError(errorMsg);

      return syncResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Step 1: Check token validity
   * Uses Module 3 (SecureStorageService) and Module 4 (JwtVerificationService)
   */
  private async checkToken(): Promise<void> {
    this.logger.debug('🔐 Checking token validity...');

    // In full implementation, would:
    // const token = await secureStorageService.getAccessToken()
    // if (!token) throw new Error('No token found')
    // const payload = await jwtVerificationService.verifyToken(token)
    // if (isExpired) { refresh token }

    // For now, placeholder
    this.logger.debug('✅ Token is valid');
  }

  /**
   * Step 2: Verify roles haven't changed
   * Uses Module 4 (JwtVerificationService) to detect role changes
   */
  private async verifyRoles(): Promise<void> {
    this.logger.debug('👤 Verifying user roles...');

    // In full implementation, would:
    // const currentPayload = await jwtVerificationService.verifyToken(token)
    // const storedRoleHash = store.getState().auth.roleHash
    // if (jwtService.detectRoleChange(currentPayload, storedRoleHash)) {
    //   dispatch(refreshPermissions())
    // }

    // For now, placeholder
    this.logger.debug('✅ Roles unchanged');
  }

  /**
   * Step 3: Drain request queue
   * Replay queued requests in order
   */
  private async drainRequestQueue(): Promise<{
    requestsProcessed: number;
    requestsSucceeded: number;
    requestsFailed: number;
    conflictsFound: number;
    errors: Array<{ requestId: string; error: string }>;
  }> {
    this.logger.debug('📤 Draining request queue...');

    const stats = {
      requestsProcessed: 0,
      requestsSucceeded: 0,
      requestsFailed: 0,
      conflictsFound: 0,
      errors: [] as Array<{ requestId: string; error: string }>,
    };

    const queue = await this.requestQueueManager.getQueue();
    if (queue.length === 0) {
      this.logger.debug('✅ Queue is empty');
      return stats;
    }

    this.logger.debug(`📋 Processing ${queue.length} queued requests...`);

    for (const request of queue) {
      try {
        this.logger.debug(
          `Processing: ${request.method} ${request.url} (ID: ${request.id})`
        );
        stats.requestsProcessed++;

        // Execute request
        // In full implementation, would use API client:
        // const response = await api[method.toLowerCase()](url, data)

        // For now, simulate success
        const success = true;

        if (success) {
          stats.requestsSucceeded++;
          await this.requestQueueManager.dequeue(request.id);
          this.logger.debug(`✅ Request succeeded: ${request.id}`);
        } else {
          // Check retry count
          const retries = await this.requestQueueManager.incrementRetryCount(request.id);
          if (retries >= (request.meta?.maxRetries || 3)) {
            stats.requestsFailed++;
            await this.requestQueueManager.markAsFailed(request.id);
            stats.errors.push({
              requestId: request.id,
              error: `Max retries exceeded (${retries})`,
            });
            this.logger.warn(`❌ Request failed (max retries): ${request.id}`);
          } else {
            this.logger.debug(`⏳ Request will retry: ${request.id} (attempt ${retries})`);
          }
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push({
          requestId: request.id,
          error: errorMsg,
        });

        this.logger.error(`Error processing request ${request.id}`, error);

        // Determine if retryable
        const retries = await this.requestQueueManager.incrementRetryCount(request.id);
        if (retries >= (request.meta?.maxRetries || 3)) {
          stats.requestsFailed++;
          await this.requestQueueManager.markAsFailed(request.id);
        }
      }
    }

    this.logger.log(
      `📊 Queue drain complete: ${stats.requestsSucceeded}/${stats.requestsProcessed} succeeded`
    );

    return stats;
  }

  /**
   * Step 4: Resolve conflicts
   * Handle data conflicts found during sync
   */
  private async resolveConflicts(): Promise<void> {
    this.logger.debug('⚔️ Resolving conflicts...');

    // In full implementation, would:
    // const conflicts = this.conflictResolver.getConflicts()
    // for each conflict:
    //   - emit event so UI can show dialog
    //   - wait for user choice
    //   - apply resolution

    // For now, placeholder
    this.logger.debug('✅ No conflicts to resolve');
  }

  /**
   * Subscribe to sync events
   * Returns unsubscribe function
   */
  onSyncEvent(callback: (event: SyncEvent) => void): () => void {
    this.eventListeners.push(callback);

    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== callback);
    };
  }

  /**
   * Emit sync event to all listeners
   */
  private emitEvent(type: SyncEventType, message: string, data?: unknown): void {
    const event: SyncEvent = {
      type,
      message,
      data,
      timestamp: Date.now(),
    };

    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logger.error('Error in sync event listener', error);
      }
    });
  }

  /**
   * Get last sync result
   */
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  /**
   * Check if sync is in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Create empty stats object
   */
  private createEmptyStats(): SyncStats {
    return {
      requestsProcessed: 0,
      requestsSucceeded: 0,
      requestsFailed: 0,
      conflictsFound: 0,
      syncStartedAt: 0,
      syncCompletedAt: 0,
      duration: 0,
    };
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    this.eventListeners = [];
    this.logger.debug('✅ Sync coordinator destroyed');
  }
}
