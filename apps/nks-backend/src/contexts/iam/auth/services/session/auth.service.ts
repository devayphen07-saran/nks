import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../../common/constants/error-codes.constants';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { SessionService } from './session.service';
import { SessionInfoDto } from '../../dto';

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
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly sessionService: SessionService,
  ) {}

  // ─── Session Lifecycle ─────────────────────────────────────────────────────

  async logout(token: string): Promise<void> {
    await this.sessionService.invalidateSessionByToken(token);
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
    const session = await this.sessionsRepository.findByToken(token);

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
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_INVALID_SESSION_TOKEN));
    }
    await this.sessionsRepository.delete(session.id);
    return this.sessionService.createSessionForUser(userId, deviceInfo);
  }

  async cleanupExpiredSessions(): Promise<{ deletedCount: number }> {
    const deletedCount = await this.sessionsRepository.deleteExpired();
    return { deletedCount };
  }

  // ─── Device Sessions ───────────────────────────────────────────────────────

  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions =
      await this.sessionsRepository.findActiveSessionsForUser(userId);
    return sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt?.toISOString() ?? new Date(0).toISOString(),
      expiresAt: s.expiresAt.toISOString(),
    }));
  }

  async terminateSession(
    userId: number,
    sessionId: number,
    requestingUserId?: number,
    isSuperAdmin: boolean = false,
  ): Promise<void> {
    if (requestingUserId && userId !== requestingUserId && !isSuperAdmin) {
      throw new ForbiddenException(errPayload(ErrorCode.AUTH_FORBIDDEN_SESSION));
    }
    const session = await this.sessionsRepository.findByIdAndUserId(
      sessionId,
      userId,
    );
    if (!session) {
      // Session not found — either already terminated by a concurrent request
      // from another device, or it never existed for this user. Treat as a
      // no-op so the client gets the same 204 either way (idempotent delete).
      this.logger.debug(
        `Session ${sessionId} not found for user ${userId} — already terminated`,
      );
      return;
    }
    await this.sessionsRepository.delete(sessionId);
    this.logger.log(`Session ${sessionId} terminated for user ${userId}`);
  }

  async terminateAllSessions(userId: number): Promise<void> {
    await this.sessionsRepository.deleteAllForUser(userId);
    this.logger.log(`All sessions terminated for user ${userId}`);
  }

}
