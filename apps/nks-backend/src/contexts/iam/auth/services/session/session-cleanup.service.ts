import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { REVOKED_SESSION_RETENTION_DAYS } from '../../auth.constants';
import { AUTH_CONSTANTS } from '../../../../../common/constants/app-constants';

/**
 * SessionCleanupService — sole owner of scheduled session maintenance.
 *
 * Concerns:
 *   1. Expired sessions             — sessions whose expiresAt has passed
 *   2. Old revoked sessions         — explicitly revoked sessions past retention window
 *   3. Per-user session limit sweep — prunes residue left by lock-free createWithinLimit races
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly sessionContextRepository: SessionContextRepository,
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
   * Runs every 5 minutes — short cadence because MAX_PER_USER is a security
   * control. Lock-free createWithinLimit can briefly overshoot under burst
   * logins; this sweep converges within minutes.
   */
  @Cron('*/5 * * * *')
  async enforcePerUserSessionLimit(): Promise<number> {
    try {
      const deleted = await this.sessionContextRepository.enforceSessionLimitGlobally(
        AUTH_CONSTANTS.SESSION.MAX_PER_USER,
      );
      if (deleted > 0) {
        this.logger.warn(
          `Per-user session limit sweep: pruned ${deleted} session(s) over cap`,
        );
      }
      return deleted;
    } catch (error) {
      this.logger.error(
        `Session limit sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedCount = await this.sessionContextRepository.deleteExpiredSessions(cutoffTime);
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

  async cleanupOldRevokedSessions(): Promise<number> {
    try {
      const deleted = await this.sessionContextRepository.deleteOldRevokedSessions(
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
