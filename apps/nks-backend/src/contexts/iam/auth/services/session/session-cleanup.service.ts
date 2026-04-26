import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { REVOKED_SESSION_RETENTION_DAYS } from '../../auth.constants';

/**
 * SessionCleanupService — sole owner of scheduled session maintenance.
 *
 * Two separate cleanup concerns, both scheduled here:
 *   1. Expired sessions   — sessions whose expiresAt has passed (1-day grace for clock skew)
 *   2. Old revoked sessions — sessions explicitly revoked (logout, theft detection) and past
 *      the retention window. Kept temporarily for theft-detection audit trail.
 *
 * Single cron entry point prevents duplicate cleanup runs and keeps the
 * schedule in one place to reason about.
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  /** Daily at 00:30 UTC — stagger from midnight to spread DB load */
  @Cron('30 0 * * *')
  async runDailyCleanup(): Promise<void> {
    await Promise.allSettled([
      this.cleanupExpiredSessions(),
      this.cleanupOldRevokedSessions(),
    ]);
  }

  /**
   * Delete sessions whose expiresAt has passed (1-day grace for clock skew).
   * Can also be called manually (admin endpoint, health check).
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedCount =
        await this.sessionsRepository.deleteExpiredSessions(cutoffTime);
      if (deletedCount > 0) {
        this.logger.log(`Expired session cleanup: deleted ${deletedCount} session(s)`);
      }
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Expired session cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /** Delete revoked sessions past the retention window. */
  async cleanupOldRevokedSessions(): Promise<number> {
    try {
      const deleted = await this.sessionsRepository.deleteOldRevokedSessions(
        REVOKED_SESSION_RETENTION_DAYS,
      );
      if (deleted > 0) {
        this.logger.log(`Revoked session cleanup: deleted ${deleted} old revoked session(s)`);
      }
      return deleted;
    } catch (error) {
      this.logger.error(
        `Revoked session cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
