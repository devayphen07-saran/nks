import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import { REVOKED_SESSION_RETENTION_DAYS } from '../../auth.constants';

/** 3 days — matches the offline session HMAC TTL */
const REVOKED_DEVICE_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * SessionCleanupService — sole owner of scheduled session maintenance.
 *
 * Three cleanup concerns, all scheduled here:
 *   1. Expired sessions        — sessions whose expiresAt has passed
 *   2. Old revoked sessions    — explicitly revoked sessions past retention window
 *   3. Expired device revocations — device revocations past the 3-day offline TTL
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
  ) {}

  /** Daily at 00:30 UTC — stagger from midnight to spread DB load */
  @Cron('30 0 * * *')
  async runDailyCleanup(): Promise<void> {
    await Promise.allSettled([
      this.cleanupExpiredSessions(),
      this.cleanupOldRevokedSessions(),
      this.cleanupExpiredDeviceRevocations(),
    ]);
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedCount = await this.sessionsRepository.deleteExpiredSessions(cutoffTime);
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

  async cleanupExpiredDeviceRevocations(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - REVOKED_DEVICE_TTL_MS);
      await this.revokedDevicesRepository.deleteExpired(cutoff);
      this.logger.debug('Revoked devices cleanup: expired entries removed');
    } catch (error) {
      this.logger.error(
        `Revoked devices cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
