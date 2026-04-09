import { Injectable, Logger } from '@nestjs/common';
import { SessionCleanupRepository } from '../repositories/session-cleanup.repository';

/**
 * Session Cleanup Service
 *
 * Utility service for cleaning up expired sessions.
 * Clean up expired sessions to prevent accumulation
 * Device tracking records are cleaned up along with sessions
 *
 * Usage:
 *   - Call cleanupExpiredSessions() manually
 *   - Or trigger via external cron job (e.g., GitHub Actions, AWS Lambda)
 *   - Recommended: Run daily or during off-peak hours
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly sessionCleanupRepository: SessionCleanupRepository,
  ) {}

  /**
   * Delete all sessions that expired more than 1 day ago.
   * This gives a grace period for clients with clock skew.
   *
   * @returns Number of sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // Calculate cutoff time: now - 1 day
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const deletedCount =
        await this.sessionCleanupRepository.deleteExpiredSessions(cutoffTime);

      if (deletedCount > 0) {
        this.logger.log(
          `Session cleanup completed. Deleted ${deletedCount} expired session(s).`,
        );
      }
      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Session cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
