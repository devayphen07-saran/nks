import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SessionAuthValidator } from '../../validators';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { SessionMapper } from '../../mapper/session.mapper';
import { SessionValidator } from '../../../../../common/validators/session.validator';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import { SessionBootstrapService } from './session-bootstrap.service';
import type {
  UserSession,
  NewUserSession,
} from '../../../../../core/database/schema/auth/user-session';
import { AUTH_CONSTANTS } from '../../../../../common/constants/app-constants';
import type { SessionInfoDto } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

export interface SessionCreateInput extends DeviceInfo {
  userId: number;
  token: string;
  expiresAt: Date;
  loginMethod?: string;
}

export interface PublicSession {
  guuid: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * SessionService — session CRUD and lifecycle.
 *
 * Owns: create, find, terminate, revoke.
 * Does NOT own: session enrichment pipeline (roles, permissions, device fingerprint).
 *   → that responsibility lives in SessionBootstrapService.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
    private readonly sessionBootstrap: SessionBootstrapService,
  ) {}

  /**
   * Create a new session for a user, atomically enforcing the session limit.
   */
  async createSession(input: SessionCreateInput): Promise<UserSession> {
    const validatedDeviceType = SessionValidator.validateDeviceType(input.deviceType);
    const validatedLoginMethod = SessionValidator.validateLoginMethod(input.loginMethod);

    const session = await this.sessionsRepository.createWithinLimit(
      input.userId,
      AUTH_CONSTANTS.SESSION.MAX_PER_USER,
      {
        userFk: input.userId,
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

  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionsRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.buildSessionInfoDtoFromRow);
  }

  async getSessionById(sessionId: number): Promise<UserSession | null> {
    return this.sessionsRepository.findById(sessionId);
  }

  async getSessionByToken(token: string): Promise<UserSession | null> {
    return this.sessionsRepository.findByToken(token);
  }

  async invalidateSession(sessionId: number): Promise<void> {
    await this.sessionsRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  /**
   * Atomically: JTI blocklisted → refresh token revoked → session row deleted.
   */
  async invalidateSessionByToken(token: string): Promise<void> {
    const session = await this.sessionsRepository.findByToken(token);
    if (!session) return;
    await this.sessionsRepository.revokeAndDeleteSession(session.id, 'LOGOUT', session.jti ?? undefined);
  }

  async terminateSession(userId: number, sessionGuuid: string): Promise<void> {
    const session = await this.sessionsRepository.findByGuuid(sessionGuuid);
    if (!session) return;

    SessionAuthValidator.assertSessionBelongsToUser(session, userId);
    await this.sessionsRepository.revokeAndDeleteSession(session.id, 'TERMINATED', session.jti ?? undefined);

    if (session.deviceId) {
      this.revokedDevicesRepository
        .revoke(session.userFk, session.deviceId, userId)
        .catch((err: unknown) => {
          this.logger.error(
            `Failed to record device revocation for session ${session.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    this.logger.debug(`Session terminated by user: ${session.id}`);
  }

  /**
   * Blocklists every outstanding JTI before deleting rows so access tokens
   * cannot outlive the full 15-min TTL window.
   */
  async terminateAllSessions(userId: number): Promise<number> {
    const jtis = await this.sessionsRepository.findJtisByUserId(userId);
    await this.sessionsRepository.revokeAndDeleteAllForUser(userId, 'TERMINATED', jtis);
    this.logger.debug(`All sessions terminated for user ${userId} (${jtis.length} JTIs blocklisted)`);
    return jtis.length;
  }

  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.sessionsRepository.revokeRefreshToken(sessionId);
  }

  // ─── BetterAuth Session Bootstrap ─────────────────────────────────────────

  /**
   * Delegates to SessionBootstrapService — create BetterAuth session stub
   * and enrich it with roles, permissions, device fingerprint, JTI.
   */
  createSessionForUser(userId: number, deviceInfo?: DeviceInfo) {
    return this.sessionBootstrap.createForUser(userId, deviceInfo);
  }
}
