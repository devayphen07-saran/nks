import { Injectable, Logger } from '@nestjs/common';
import { SessionAuthValidator } from '../../validators';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { SessionService } from './session.service';
import { AuditService } from '../../../../compliance/audit/audit.service';

/**
 * AuthService
 *
 * Thin session-management facade. All heavy auth flows have been extracted:
 *   - Login / register      → PasswordAuthService   (flows/password/)
 *   - Credential onboarding → OnboardingService       (flows/onboarding)
 *   - Token refresh/verify  → TokenLifecycleService  (token/)
 *   - Session creation      → SessionService
 *
 * What remains here:
 *   - logout / session status / session rotation
 *   - getUserSessions / terminateSession / terminateAllSessions
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionContextRepository: SessionContextRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Session Lifecycle ─────────────────────────────────────────────────────

  async logout(token: string, userId: number): Promise<void> {
    await this.sessionService.invalidateSessionByToken(token);
    this.auditService.logLogout(userId);
  }

  /**
   * Check session revocation status for mobile reconnection.
   *
   * Distinguishes three states:
   * - **active**: session exists and is not revoked (may be expired — refresh handles that)
   * - **revoked**: session was actively terminated (logout, theft detection, admin action)
   * - **wipe**: user account is blocked — device data must be wiped
   *
   * An expired-but-not-revoked session returns `{active: true, revoked: false}` so the
   * mobile reconnection handler proceeds to the token refresh step instead of wiping.
   */
  async checkSessionStatus(
    token: string,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const session = await this.sessionRepository.findByToken(token);

    // Unknown token — treat as revoked (could be already cleaned up)
    if (!session) return { active: false, revoked: true, wipe: false };

    // Actively revoked (logout, theft detection, admin termination)
    if (session.refreshTokenRevokedAt) {
      return { active: false, revoked: true, wipe: false };
    }

    // Check if user is blocked → wipe device
    const user = await this.authUsersRepository.findById(
      Number(session.userId),
    );
    if (user?.isBlocked) {
      return { active: false, revoked: true, wipe: true };
    }

    // Session exists and is not revoked. Even if session.expiresAt has passed,
    // that's handled by the refresh-token step — not a revocation event.
    return { active: true, revoked: false, wipe: false };
  }

  async invalidateUserSessions(
    userId: number,
    reason = 'ROLE_CHANGE',
  ): Promise<void> {
    const count = await this.sessionService.terminateAllSessions(userId);
    this.logger.log(
      `Invalidated ${count} session(s) for user ${userId}: ${reason}`,
    );
  }

  /**
   * Rotate the session: revoke old token, issue a new BetterAuth session.
   * Preserves device fingerprint from the original session.
   */
  async rotateSession(
    oldToken: string,
    userId: number,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<{ token: string; expiresAt: Date }> {
    const session = await this.sessionsRepository.findByToken(oldToken);
    SessionAuthValidator.assertSessionOwnership(session, userId);

    // Create the new session BEFORE deleting the old one.
    // If createSessionForUser throws (DB error, BetterAuth issue), the old session
    // is still alive and the user is not locked out. The inverse order (delete then
    // create) risks a permanent lockout when the create step fails.
    const newSession = await this.sessionService.createSessionForUser(
      userId,
      deviceInfo,
    );
    await this.sessionsRepository.delete(session.id);
    return newSession;
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.sessionsRepository.deleteExpired();
    return { deletedCount };
  }
}
