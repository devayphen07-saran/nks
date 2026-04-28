import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import { SessionAuthValidator } from '../../validators';
import { SessionValidator } from '../../../../../common/validators/session.validator';
import { SessionBootstrapService } from './session-bootstrap.service';
import { AUTH_CONSTANTS } from '../../../../../common/constants/app-constants';
import type { UserSession, NewUserSession } from '../../../../../core/database/schema/auth/user-session';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

export interface SessionCreateInput extends DeviceInfo {
  userId: number;
  token: string;
  expiresAt: Date;
  loginMethod?: string;
}

@Injectable()
export class SessionCommandService {
  private readonly logger = new Logger(SessionCommandService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
    private readonly sessionBootstrap: SessionBootstrapService,
  ) {}

  async createSession(input: SessionCreateInput): Promise<UserSession> {
    const validatedDeviceType = SessionValidator.validateDeviceType(input.deviceType);
    const validatedLoginMethod = SessionValidator.validateLoginMethod(input.loginMethod);

    const session = await this.sessionsRepository.createWithinLimit(
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
    await this.sessionsRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  async invalidateSessionByToken(token: string): Promise<void> {
    const session = await this.sessionsRepository.findByToken(token);
    if (!session) return;
    await this.sessionsRepository.revokeSession(session.id, 'LOGOUT', session.jti ?? undefined);
  }

  async terminateSession(userId: number, sessionGuuid: string): Promise<void> {
    const session = await this.sessionsRepository.findByGuuid(sessionGuuid);
    if (!session) return;

    SessionAuthValidator.assertSessionBelongsToUser(session, userId);
    await this.sessionsRepository.revokeSession(session.id, 'TERMINATED', session.jti ?? undefined);

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
    const jtis = await this.sessionsRepository.findJtisByUserId(userId);
    await this.sessionsRepository.revokeAllForUser(userId, 'TERMINATED', jtis);
    this.logger.debug(`All sessions terminated for user ${userId} (${jtis.length} JTIs blocklisted)`);
    return jtis.length;
  }

  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.sessionsRepository.revokeRefreshToken(sessionId);
  }

  createSessionForUser(userId: number, deviceInfo?: DeviceInfo) {
    return this.sessionBootstrap.createForUser(userId, deviceInfo);
  }
}
