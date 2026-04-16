import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ErrorCodes, ErrorMessages } from '../../../../core/constants/error-codes';
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

  async checkSessionStatus(
    token: string,
  ): Promise<{ active: boolean; revoked: boolean; wipe: boolean }> {
    const session = await this.sessionsRepository.findByToken(token);

    if (!session) return { active: false, revoked: true, wipe: false };
    if (session.expiresAt < new Date())
      return { active: false, revoked: true, wipe: false };

    const user = await this.authUsersRepository.findById(
      Number(session.userId),
    );
    return { active: true, revoked: false, wipe: user?.isBlocked ?? false };
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
      throw new UnauthorizedException({ errorCode: ErrorCodes.AUTH_INVALID_SESSION_TOKEN, message: ErrorMessages[ErrorCodes.AUTH_INVALID_SESSION_TOKEN] });
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
      throw new ForbiddenException({ errorCode: ErrorCodes.AUTH_FORBIDDEN_SESSION, message: ErrorMessages[ErrorCodes.AUTH_FORBIDDEN_SESSION] });
    }
    const session = await this.sessionsRepository.findByIdAndUserId(
      sessionId,
      userId,
    );
    if (!session)
      throw new NotFoundException({ errorCode: ErrorCodes.AUTH_SESSION_NOT_FOUND, message: ErrorMessages[ErrorCodes.AUTH_SESSION_NOT_FOUND] });
    await this.sessionsRepository.delete(sessionId);
    this.logger.log(`Session ${sessionId} terminated for user ${userId}`);
  }

  async terminateAllSessions(userId: number): Promise<void> {
    await this.sessionsRepository.deleteAllForUser(userId);
    this.logger.log(`All sessions terminated for user ${userId}`);
  }

}
