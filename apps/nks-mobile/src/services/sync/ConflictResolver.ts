import { AxiosError } from 'axios';
import { Logger } from '@/utils/logger';
import { QueuedRequest } from './RequestQueueManager';

/**
 * ✅ MODULE 5 PHASE 6: Conflict Resolver
 *
 * Purpose:
 * - Detect data conflicts during sync
 * - Provide resolution strategies
 * - Show UI prompts for user choice
 * - Apply resolution and recover
 *
 * Conflict Types:
 * - Version Mismatch: Data changed on both ends
 * - Resource Deleted: Server deleted, client queued mutation
 * - Permission Denied: User lost permission while offline
 * - Dependency Missing: Referenced resource no longer exists
 *
 * Resolution Strategies:
 * - SKIP: Discard queued request
 * - OVERWRITE: Send queued request (user's data wins)
 * - KEEP_SERVER: Use server's data (discard queue)
 * - MERGE: Combine both versions (smart merge)
 */

export interface Conflict {
  requestId: string;
  requestData: unknown;
  serverData?: unknown;
  type: 'version_mismatch' | 'deleted' | 'permission_denied' | 'dependency_missing';
  httpStatus: number;
  message: string;
}

export type ResolutionStrategy = 'skip' | 'overwrite' | 'keep_server' | 'merge';

export interface ConflictResolution {
  conflictId: string;
  strategy: ResolutionStrategy;
  timestamp: number;
}

export class ConflictResolver {
  private static readonly logger = new Logger('ConflictResolver');
  private conflicts: Map<string, Conflict> = new Map();
  private resolutions: Map<string, ConflictResolution> = new Map();
  private promptCallback: ((conflict: Conflict) => Promise<ResolutionStrategy>) | null = null;

  /**
   * Register UI prompt callback
   * Called when user input needed for conflict resolution
   */
  setPromptCallback(
    callback: (conflict: Conflict) => Promise<ResolutionStrategy>
  ): void {
    this.promptCallback = callback;
    this.logger.debug('✅ Prompt callback registered');
  }

  /**
   * Detect conflict from API error response
   */
  async detectConflict(
    request: QueuedRequest,
    error: AxiosError
  ): Promise<Conflict | null> {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, unknown> | undefined;

    if (!status || !data) {
      return null;
    }

    let conflictType: Conflict['type'] | null = null;
    let message = '';

    switch (status) {
      case 409:
        // Conflict - version mismatch
        conflictType = 'version_mismatch';
        message = 'Data changed on server. Choose resolution strategy.';
        break;

      case 404:
        // Not found - resource deleted
        conflictType = 'deleted';
        message = 'Resource no longer exists on server.';
        break;

      case 403:
        // Forbidden - permission denied
        conflictType = 'permission_denied';
        message = 'Permission denied. Your role may have changed.';
        break;

      case 400:
        // Bad request - dependency missing
        if (
          data.message &&
          (typeof data.message === 'string' &&
            (data.message.includes('not found') || data.message.includes('does not exist')))
        ) {
          conflictType = 'dependency_missing';
          message = 'Referenced resource does not exist.';
        }
        break;
    }

    if (!conflictType) {
      return null;
    }

    const conflict: Conflict = {
      requestId: request.id,
      requestData: {
        method: request.method,
        url: request.url,
        data: request.data,
      },
      serverData: data,
      type: conflictType,
      httpStatus: status,
      message,
    };

    this.logger.warn(`⚔️ Conflict detected: ${conflictType} (${request.id})`);
    this.conflicts.set(request.id, conflict);

    return conflict;
  }

  /**
   * Resolve conflict using specified strategy
   */
  async resolveConflict(
    conflict: Conflict,
    strategy: ResolutionStrategy
  ): Promise<void> {
    this.logger.debug(
      `🔧 Resolving conflict ${conflict.requestId} with strategy: ${strategy}`
    );

    const resolution: ConflictResolution = {
      conflictId: conflict.requestId,
      strategy,
      timestamp: Date.now(),
    };

    this.resolutions.set(conflict.requestId, resolution);

    // Apply resolution strategy
    switch (strategy) {
      case 'skip':
        this.logger.log(`⏭️ Skipped request: ${conflict.requestId}`);
        break;

      case 'overwrite':
        this.logger.log(`💪 Overwriting server data: ${conflict.requestId}`);
        // Request will be retried with same data
        break;

      case 'keep_server':
        this.logger.log(`🔄 Keeping server version: ${conflict.requestId}`);
        // Update local cache with server data
        break;

      case 'merge':
        this.logger.log(`🤝 Merging versions: ${conflict.requestId}`);
        // Perform smart merge of both versions
        await this.performMerge(conflict);
        break;
    }

    // Clean up conflict record
    this.conflicts.delete(conflict.requestId);
  }

  /**
   * Prompt user for resolution strategy
   * Shows UI dialog with options
   */
  async promptUser(conflict: Conflict): Promise<ResolutionStrategy> {
    if (!this.promptCallback) {
      this.logger.warn('⚠️ No prompt callback set, defaulting to SKIP');
      return 'skip';
    }

    try {
      const strategy = await this.promptCallback(conflict);
      this.logger.debug(`👤 User chose: ${strategy}`);
      return strategy;
    } catch (error) {
      this.logger.error('Error showing conflict prompt', error);
      return 'skip'; // Default to skip on error
    }
  }

  /**
   * Perform smart merge of conflicting versions
   */
  private async performMerge(conflict: Conflict): Promise<void> {
    this.logger.debug(`🤝 Attempting merge for ${conflict.requestId}`);

    // In full implementation, would:
    // - For updates: merge field-by-field (last-write-wins per field)
    // - For creates: use server version
    // - For deletes: check if exists, skip if deleted

    // Simple example:
    if (conflict.type === 'version_mismatch') {
      const requestData = conflict.requestData as Record<string, unknown> | undefined;
      const serverData = conflict.serverData as Record<string, unknown> | undefined;

      if (requestData && serverData) {
        // Merge: combine fields, user's changes take precedence
        const merged = {
          ...serverData,
          ...requestData,
        };

        this.logger.debug(`✅ Merged successfully: ${JSON.stringify(merged)}`);
        // In full impl, would update cache with merged data
      }
    }
  }

  /**
   * Get all unresolved conflicts
   */
  getConflicts(): Conflict[] {
    return Array.from(this.conflicts.values());
  }

  /**
   * Get conflict by request ID
   */
  getConflict(requestId: string): Conflict | undefined {
    return this.conflicts.get(requestId);
  }

  /**
   * Get all resolutions
   */
  getResolutions(): ConflictResolution[] {
    return Array.from(this.resolutions.values());
  }

  /**
   * Check if conflict exists
   */
  hasConflict(requestId: string): boolean {
    return this.conflicts.has(requestId);
  }

  /**
   * Get detailed conflict info for debugging
   */
  getConflictInfo(): {
    total: number;
    byType: Record<string, number>;
    conflicts: Array<{
      id: string;
      type: string;
      status: number;
      message: string;
    }>;
  } {
    const byType: Record<string, number> = {};
    const conflicts: Array<{
      id: string;
      type: string;
      status: number;
      message: string;
    }> = [];

    this.conflicts.forEach((conflict) => {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
      conflicts.push({
        id: conflict.requestId,
        type: conflict.type,
        status: conflict.httpStatus,
        message: conflict.message,
      });
    });

    return {
      total: this.conflicts.size,
      byType,
      conflicts,
    };
  }

  /**
   * Clear all conflicts and resolutions
   */
  clear(): void {
    this.conflicts.clear();
    this.resolutions.clear();
    this.logger.debug('✅ Conflicts cleared');
  }

  /**
   * Cleanup on app shutdown
   */
  destroy(): void {
    this.conflicts.clear();
    this.resolutions.clear();
    this.promptCallback = null;
    this.logger.debug('✅ Conflict resolver destroyed');
  }

  /**
   * Helper: Create user-friendly error message
   */
  static getErrorMessage(conflict: Conflict): string {
    switch (conflict.type) {
      case 'version_mismatch':
        return 'This data was changed on the server. You can overwrite it with your changes or keep the server version.';

      case 'deleted':
        return 'The resource was deleted on the server. You can skip this request or try to recreate it.';

      case 'permission_denied':
        return 'You no longer have permission to perform this action. Your role may have changed.';

      case 'dependency_missing':
        return 'A required resource no longer exists. Please check your data and try again.';

      default:
        return 'An unknown conflict occurred. Please resolve manually.';
    }
  }
}
