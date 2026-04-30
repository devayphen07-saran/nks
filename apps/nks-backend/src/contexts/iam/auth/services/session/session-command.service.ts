import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SessionRepository } from '../../repositories/session.repository';
import { SessionRevocationRepository } from '../../repositories/session-revocation.repository';
import { SessionContextRepository } from '../../repositories/session-context.repository';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import { SessionAuthValidator } from '../../validators';
import { SessionValidator } from '../../../../../common/validators/session.validator';
import { AUTH_CONSTANTS } from '../../../../../common/constants/app-constants';
import type { UserSession, NewUserSession } from '../../../../../core/database/schema/auth/user-session';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

export interface SessionCreateInput extends DeviceInfo {
  userId: number;
  token: string;
  expiresAt: Date;
  loginMethod?: string;
}

/**
 * SessionCommandService
 *
 * Manages user session lifecycle (create, invalidate, terminate, revoke tokens).
 * Called during and after authentication flows.
 *
 * Authorization Contract:
 *   - No explicit permission checks needed — sessions are session-user scoped
 *   - createSession(): Called by AuthFlowOrchestratorService after user authentication
 *   - invalidateSession()/invalidateSessionByToken(): Internal logout operations
 *   - terminateSession(): Requires userId ownership — user can only terminate own sessions
 *   - terminateAllSessions(): User terminates all their own sessions (no permission check needed)
 *
 * Business Rule Validation:
 *   - Max sessions per user enforced (AUTH_CONSTANTS.SESSION.MAX_PER_USER)
 *   - Device type and login method validated before session creation
 *   - terminateSession checks session belongs to the terminating user
 *   - Device revocation tracked when session has device binding
 *
 * Audit Trail:
 *   - userId parameter identifies session owner
 *   - Session termination reason tracked (LOGOUT, TERMINATED)
 *   - Device revocation history maintained for security
 *   - JTI blocklist captures all revoked token identifiers
 */
@Injectable()
export class SessionCommandService {
  private readonly logger = new Logger(SessionCommandService.name);

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly sessionContextRepository: SessionContextRepository,
    private readonly sessionRevocationRepository: SessionRevocationRepository,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
  ) {}

  async createSession(input: SessionCreateInput): Promise<UserSession> {
    const validatedDeviceType = SessionValidator.validateDeviceType(input.deviceType);
    const validatedLoginMethod = SessionValidator.validateLoginMethod(input.loginMethod);

    const session = await this.sessionContextRepository.createWithinLimit(
      input.userId,
      AUTH_CONSTANTS.SESSION.MAX_PER_USER,
      {
        userId: input.userId,
        token: input.token,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        deviceType: validatedDeviceType,
        platform: input.platform,
        appVersion: input.appVersion,
        loginMethod: validatedLoginMethod,
        csrfSecret: crypto.randomBytes(32).toString('hex'),
      } as NewUserSession,
    );

    SessionAuthValidator.assertSessionCreated(session);
    this.logger.debug(`Session created for user ${input.userId} (device: ${input.deviceName})`);
    return session;
  }

  async invalidateSession(sessionId: number): Promise<void> {
    await this.sessionRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  async invalidateSessionByToken(token: string): Promise<void> {
    const session = await this.sessionRepository.findByToken(token);
    if (!session) return;
    await this.sessionRevocationRepository.revokeSession(session.id, 'LOGOUT', session.jti ?? undefined);
  }

  async terminateSession(userId: number, sessionGuuid: string): Promise<void> {
    const session = await this.sessionRepository.findByGuuid(sessionGuuid);
    if (!session) return;

    SessionAuthValidator.assertSessionBelongsToUser(session, userId);
    await this.sessionRevocationRepository.revokeSession(session.id, 'TERMINATED', session.jti ?? undefined);

    if (session.deviceId) {
      this.revokedDevicesRepository
        .revoke(session.userId, session.deviceId, userId)
        .catch((err: unknown) => {
          this.logger.error(
            `Failed to record device revocation for session ${session.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    this.logger.debug(`Session terminated by user: ${session.id}`);
  }

  async terminateAllSessions(userId: number): Promise<number> {
    const jtis = await this.sessionRevocationRepository.findJtisByUserId(userId);
    await this.sessionRevocationRepository.revokeAllForUser(userId, 'TERMINATED', jtis);
    this.logger.debug(`All sessions terminated for user ${userId} (${jtis.length} JTIs blocklisted)`);
    return jtis.length;
  }

  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.sessionRevocationRepository.revokeRefreshToken(sessionId);
  }

}
