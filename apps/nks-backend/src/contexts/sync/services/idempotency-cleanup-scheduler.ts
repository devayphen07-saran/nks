import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncRepository } from '../repositories/sync.repository';

/**
 * Scheduled cleanup of expired idempotency log entries.
 *
 * Purpose:
 * - Prevents idempotency_log table from growing unbounded
 * - Entries expire after 24 hours (configurable via IDEMPOTENCY_LOG_TTL_HOURS)
 * - Runs periodically (default: every 1 hour)
 *
 * Configuration (env vars):
 * - IDEMPOTENCY_CLEANUP_ENABLED=true (default)
 * - IDEMPOTENCY_CLEANUP_INTERVAL_MS=3600000 (1 hour, default)
 * - IDEMPOTENCY_LOG_TTL_HOURS=24 (enforced in the table schema)
 */
@Injectable()
export class IdempotencyCleanupScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IdempotencyCleanupScheduler.name);
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly syncRepository: SyncRepository,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get('IDEMPOTENCY_CLEANUP_ENABLED', true);
    if (!enabled) {
      this.logger.debug('Idempotency cleanup scheduler disabled via config');
      return;
    }

    const intervalMs = this.configService.get('IDEMPOTENCY_CLEANUP_INTERVAL_MS', 3600000); // 1 hour

    this.cleanupInterval = setInterval(() => {
      this._runCleanup().catch((err) =>
        this.logger.error('Idempotency cleanup failed:', err),
      );
    }, intervalMs);

    this.logger.info(`Idempotency cleanup scheduled every ${intervalMs}ms`);
    // Run once on startup to clean up any backlog
    this._runCleanup().catch((err) =>
      this.logger.error('Initial idempotency cleanup failed:', err),
    );
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Idempotency cleanup scheduler stopped');
    }
  }

  private async _runCleanup(): Promise<void> {
    const startMs = Date.now();
    try {
      await this.syncRepository.deleteExpiredIdempotencyEntries();
      const durationMs = Date.now() - startMs;
      this.logger.debug(`Idempotency cleanup completed in ${durationMs}ms`);
    } catch (err) {
      this.logger.error('Failed to delete expired idempotency entries:', err);
      throw err;
    }
  }
}
