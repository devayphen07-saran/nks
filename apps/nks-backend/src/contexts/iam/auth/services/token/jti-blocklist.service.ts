import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JtiBlocklistRepository } from '../../repositories/jti-blocklist.repository';
import { ACCESS_TOKEN_TTL_MS } from '../../auth.constants';

/**
 * JtiBlocklistService
 *
 * Tracks revoked JWT IDs (jti claims) so that short-lived access tokens are
 * immediately unusable after session termination, not just after their
 * natural 15-minute expiry.
 *
 * Flow:
 *   1. On login, the session row stores the JWT's jti.
 *   2. On logout / session terminate, the jti is written here with
 *      expires_at = now + ACCESS_TOKEN_TTL_MS.
 *   3. AuthGuard checks isBlocked(jti) after validating the session token.
 *
 * Storage: PostgreSQL table `jti_blocklist` (migration 023). Row-level
 * access lives in `JtiBlocklistRepository`; this service owns the TTL
 * policy, the cron schedule, and the operator-facing log lines.
 */
@Injectable()
export class JtiBlocklistService {
  private readonly logger = new Logger(JtiBlocklistService.name);

  constructor(
    private readonly jtiBlocklistRepository: JtiBlocklistRepository,
  ) {}

  /**
   * Add a jti to the blocklist.
   * Called when a session is revoked (logout, terminate, password change).
   *
   * @param jti   UUID string from the JWT's jti claim
   * @param ttlMs How long to block — defaults to `ACCESS_TOKEN_TTL_MS` (15 min)
   */
  async block(jti: string, ttlMs: number = ACCESS_TOKEN_TTL_MS): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs);
    await this.jtiBlocklistRepository.insert(jti, expiresAt);
  }

  /**
   * Check whether a jti is currently blocklisted.
   * Returns false for unknown or expired entries.
   */
  async isBlocked(jti: string): Promise<boolean> {
    const expiry = await this.jtiBlocklistRepository.findExpiryByJti(jti);
    if (!expiry) return false;
    return expiry > new Date();
  }

  /**
   * Remove expired entries — runs daily at 03:00.
   * Entries live at most 15 minutes so this is mostly a tidying operation.
   */
  @Cron('0 3 * * *')
  async cleanupExpired(): Promise<void> {
    const count = await this.jtiBlocklistRepository.deleteExpired(new Date());
    if (count > 0) {
      this.logger.log(`JTI blocklist cleanup: removed ${count} expired entries`);
    }
  }
}
