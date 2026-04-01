import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '@/utils/logger';

/**
 * ✅ MODULE 5 PHASE 2: Request Queue Manager
 *
 * Purpose:
 * - Queue API requests when offline
 * - Persist queue to disk (crash recovery)
 * - Replay requests when online
 * - Track retry attempts
 * - Support request prioritization
 *
 * Usage:
 * - Enqueue requests in offline state
 * - Drain queue during sync phase
 * - Query queue size for UI
 */

export interface QueuedRequest {
  id: string;                          // Unique request ID
  timestamp: number;                   // When queued (ms)
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;                         // API endpoint
  data?: Record<string, unknown>;      // Request body
  headers?: Record<string, string>;    // Custom headers
  meta?: {
    retryCount?: number;               // Current retry count
    maxRetries?: number;               // Max retries allowed
    priority?: 'high' | 'normal' | 'low';
    onSuccess?: string;                // Redux action on success
    onError?: string;                  // Redux action on error
    userId?: number;                   // For audit trail
  };
}

interface QueueStats {
  totalQueued: number;
  totalDequeued: number;
  totalFailed: number;
  queueSize: number;
  oldestRequestAge: number;  // seconds
}

const QUEUE_KEY = 'request_queue';
const QUEUE_STATS_KEY = 'queue_stats';
const MAX_QUEUE_SIZE = 100;
const DEFAULT_MAX_RETRIES = 3;

export class RequestQueueManager {
  private static readonly logger = new Logger('RequestQueueManager');
  private queue: QueuedRequest[] = [];
  private stats: QueueStats = {
    totalQueued: 0,
    totalDequeued: 0,
    totalFailed: 0,
    queueSize: 0,
    oldestRequestAge: 0,
  };

  /**
   * Initialize queue from persistent storage
   */
  async initialize(): Promise<void> {
    try {
      await this.loadFromDisk();
      this.logger.debug(
        `✅ Request queue initialized. Size: ${this.queue.length}, Stats: ${JSON.stringify(this.stats)}`
      );
    } catch (error) {
      this.logger.error('Failed to initialize queue', error);
      this.queue = [];
    }
  }

  /**
   * Add request to queue
   * Returns request ID for tracking
   */
  async enqueue(
    request: Omit<QueuedRequest, 'id' | 'timestamp'>
  ): Promise<string> {
    try {
      // Check queue size limit
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        this.logger.warn(`⚠️ Queue full (${MAX_QUEUE_SIZE} requests). Dropping oldest request.`);
        this.queue.shift();
      }

      // Create queued request
      const queuedRequest: QueuedRequest = {
        ...request,
        id: this.generateRequestId(),
        timestamp: Date.now(),
        meta: {
          retryCount: 0,
          maxRetries: DEFAULT_MAX_RETRIES,
          priority: 'normal',
          ...request.meta,
        },
      };

      // Add to queue
      this.queue.push(queuedRequest);
      this.stats.totalQueued++;
      this.stats.queueSize = this.queue.length;

      // Persist to disk
      await this.persist();

      this.logger.debug(
        `📝 Request queued: ${queuedRequest.method} ${queuedRequest.url} (ID: ${queuedRequest.id})`
      );

      return queuedRequest.id;
    } catch (error) {
      this.logger.error('Failed to enqueue request', error);
      throw new Error('Queue enqueue failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Get all queued requests (sorted by priority)
   */
  async getQueue(): Promise<QueuedRequest[]> {
    // Sort by priority (high first) then by timestamp
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return [...this.queue].sort((a, b) => {
      const priorityA = priorityOrder[a.meta?.priority || 'normal'];
      const priorityB = priorityOrder[b.meta?.priority || 'normal'];
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Get request by ID
   */
  async getRequest(requestId: string): Promise<QueuedRequest | null> {
    return this.queue.find((r) => r.id === requestId) || null;
  }

  /**
   * Remove request from queue (after successful processing)
   */
  async dequeue(requestId: string): Promise<void> {
    try {
      const index = this.queue.findIndex((r) => r.id === requestId);
      if (index !== -1) {
        this.queue.splice(index, 1);
        this.stats.queueSize = this.queue.length;
        this.stats.totalDequeued++;

        await this.persist();

        this.logger.debug(`✅ Request dequeued: ${requestId}`);
      }
    } catch (error) {
      this.logger.error('Failed to dequeue request', error);
    }
  }

  /**
   * Update request retry count
   */
  async incrementRetryCount(requestId: string): Promise<number> {
    const request = this.queue.find((r) => r.id === requestId);
    if (request && request.meta) {
      request.meta.retryCount = (request.meta.retryCount || 0) + 1;
      await this.persist();
      return request.meta.retryCount;
    }
    return 0;
  }

  /**
   * Mark request as failed (max retries exceeded)
   */
  async markAsFailed(requestId: string): Promise<void> {
    try {
      await this.dequeue(requestId);
      this.stats.totalFailed++;
      await this.persist();

      this.logger.warn(`❌ Request marked as failed: ${requestId}`);
    } catch (error) {
      this.logger.error('Failed to mark request as failed', error);
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const now = Date.now();
    const oldestRequest = this.queue[0];
    const oldestAge = oldestRequest
      ? Math.floor((now - oldestRequest.timestamp) / 1000)
      : 0;

    return {
      ...this.stats,
      oldestRequestAge: oldestAge,
    };
  }

  /**
   * Get queue size
   */
  getSize(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clear entire queue
   */
  async clear(): Promise<void> {
    try {
      this.queue = [];
      this.stats.queueSize = 0;
      await this.persist();

      this.logger.debug('✅ Queue cleared');
    } catch (error) {
      this.logger.error('Failed to clear queue', error);
    }
  }

  /**
   * Persist queue to disk
   */
  async persist(): Promise<void> {
    try {
      const data = {
        queue: this.queue,
        stats: this.stats,
        persistedAt: Date.now(),
      };

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(data));
      this.logger.debug(`💾 Queue persisted (${this.queue.length} requests)`);
    } catch (error) {
      this.logger.error('Failed to persist queue', error);
    }
  }

  /**
   * Load queue from disk (on app restart)
   */
  async loadFromDisk(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.queue = parsed.queue || [];
        this.stats = parsed.stats || this.stats;

        const age = Math.floor((Date.now() - parsed.persistedAt) / 1000);
        this.logger.debug(
          `📂 Queue loaded from disk (${this.queue.length} requests, persisted ${age}s ago)`
        );
      }
    } catch (error) {
      this.logger.error('Failed to load queue from disk', error);
      this.queue = [];
    }
  }

  /**
   * Get detailed queue info for debugging
   */
  getDetailedInfo(): {
    size: number;
    stats: QueueStats;
    requests: Array<{
      id: string;
      method: string;
      url: string;
      priority: string;
      retries: number;
      age: number;
    }>;
  } {
    const now = Date.now();
    return {
      size: this.queue.length,
      stats: this.getStats(),
      requests: this.queue.map((r) => ({
        id: r.id,
        method: r.method,
        url: r.url,
        priority: r.meta?.priority || 'normal',
        retries: r.meta?.retryCount || 0,
        age: Math.floor((now - r.timestamp) / 1000),
      })),
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `req_${timestamp}_${random}`;
  }
}
