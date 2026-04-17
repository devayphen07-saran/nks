import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { SessionMapper } from '../../mappers/session.mapper';
import { SessionValidator } from '../../../../common/validators/session.validator';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { JWTConfigService } from '../../../../config/jwt.config';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { JtiBlocklistService } from '../token/jti-blocklist.service';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import type { SessionUserRole } from '../../interfaces/session-user.interface';
import type {
  UserSession,
  NewUserSession,
} from '../../../../core/database/schema/auth/user-session';
import { JWT_AUDIENCE } from '../../auth.constants';

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  appVersion?: string;
}

export interface SessionCreateInput extends DeviceInfo {
  userId: number;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  loginMethod?: string;
}

export interface PublicSession {
  id: number;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  expiresAt: Date;
  createdAt: Date;
}

const MAX_SESSIONS_PER_USER = 5;

/**
 * SessionService
 * Responsible for session lifecycle management
 * Responsibilities:
 * - Create sessions with device tracking
 * - Retrieve active sessions
 * - Terminate sessions
 * - Enforce session limits
 * - Clean up expired sessions
 * - Mark sessions for token rotation
 */
const REVOKED_SESSION_RETENTION_DAYS = 30;

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly permissionsService: PermissionsService,
    private readonly jwtConfigService: JWTConfigService,
    private readonly configService: ConfigService,
    private readonly authUtils: AuthUtilsService,
    private readonly jtiBlocklist: JtiBlocklistService,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

  private readonly ipHmacSecret: string;

  @Cron('0 0 * * *') // Daily at midnight
  runCleanup(): void {
    this.sessionsRepository
      .deleteOldRevokedSessions(REVOKED_SESSION_RETENTION_DAYS)
      .then((deleted) => {
        if (deleted > 0) {
          this.logger.log(`Session cleanup: deleted ${deleted} old revoked sessions`);
        }
      })
      .catch((err: Error) => {
        this.logger.error(`Session cleanup failed: ${err.message}`);
      });
  }

  /**
   * Create a new session for a user, atomically enforcing the session limit.
   *
   * The limit check and insert execute inside a single DB transaction via
   * `createWithinLimit`, eliminating the TOCTOU race condition where two
   * concurrent logins both pass the pre-insert count check and both create
   * a session — exceeding the cap.
   */
  async createSession(input: SessionCreateInput): Promise<UserSession> {
    // Validate and normalize enum values
    const validatedDeviceType = SessionValidator.validateDeviceType(
      input.deviceType,
    );
    const validatedLoginMethod = SessionValidator.validateLoginMethod(
      input.loginMethod,
    );

    // Atomic: delete excess sessions + insert new session in one transaction
    const session = await this.sessionsRepository.createWithinLimit(
      input.userId,
      MAX_SESSIONS_PER_USER,
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
      } as NewUserSession,
    );

    if (!session) {
      throw new InternalServerErrorException('Failed to create session');
    }

    this.logger.debug(
      `Session created for user ${input.userId} (device: ${input.deviceName})`,
    );

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<PublicSession[]> {
    const sessions = await this.sessionsRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.toPublicSession);
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: number): Promise<UserSession | null> {
    return this.sessionsRepository.findById(sessionId);
  }

  /**
   * Get session by token
   */
  async getSessionByToken(token: string): Promise<UserSession | null> {
    return this.sessionsRepository.findByToken(token);
  }

  /**
   * Invalidate a session (logout from specific device)
   */
  async invalidateSession(sessionId: number): Promise<void> {
    await this.sessionsRepository.delete(sessionId);
    this.logger.debug(`Session invalidated: ${sessionId}`);
  }

  /**
   * Invalidate session by token
   */
  async invalidateSessionByToken(token: string): Promise<void> {
    const session = await this.sessionsRepository.findByToken(token);
    if (session) {
      // Blocklist the JWT before deleting the session row so the 15-min
      // access token window is closed immediately.
      if (session.jti) {
        this.jtiBlocklist.block(session.jti).catch(() => {});
      }
      await this.invalidateSession(session.id);
    }
  }

  /**
   * Terminate a specific session (admin/user action)
   */
  async terminateSession(userId: number, sessionId: number): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('Cannot terminate other user sessions');
    }

    if (session.jti) {
      this.jtiBlocklist.block(session.jti).catch(() => {});
    }

    // If the session had a deviceId, revoke it so offline pushes from that device
    // are rejected even while the 3-day offline HMAC signature is still valid.
    if (session.deviceId) {
      this.revokedDevicesRepository
        .revoke(session.userId, session.deviceId, userId)
        .catch((err: unknown) => {
          this.logger.error(
            `Failed to record device revocation for session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    await this.invalidateSession(sessionId);
    this.logger.debug(`Session terminated by user: ${sessionId}`);
  }

  /**
   * Terminate all sessions for a user (logout everywhere)
   */
  async terminateAllSessions(userId: number): Promise<number> {
    const count = await this.sessionsRepository.deleteAllForUser(userId);
    this.logger.debug(`All sessions terminated for user ${userId}: ${count}`);
    return count;
  }

  /**
   * Revoke refresh token (theft detection)
   */
  async revokeRefreshToken(sessionId: number): Promise<void> {
    await this.sessionsRepository.revokeRefreshToken(sessionId);
  }

  /**
   * Set active store for session
   */
  async setActiveStore(sessionId: number, storeId: number): Promise<void> {
    const session = await this.sessionsRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.sessionsRepository.setActiveStore(sessionId, storeId);
    this.logger.debug(`Active store set for session ${sessionId}: ${storeId}`);
  }

  /**
   * Enforce session limit per user.
   * Uses atomic SQL to delete excess sessions in a single query,
   * preventing race conditions from concurrent logins.
   */
  async enforceSessionLimit(userId: number): Promise<void> {
    await this.sessionsRepository.deleteExcessSessions(
      userId,
      MAX_SESSIONS_PER_USER - 1, // -1 to make room for the new session about to be created
    );
  }

  // ─── BetterAuth Session Creation ──────────────────────────────────────────

  /**
   * Create a BetterAuth session for a user and embed roles + JWT into it.
   * Called by AuthFlowOrchestrator and AuthService.rotateSession.
   */
  async createSessionForUser(
    userId: number,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<{
    token: string;
    expiresAt: Date;
    sessionGuuid: string;
    jwtToken?: string;
    userRoles: SessionUserRole[];
    userEmail: string;
    permissions: Awaited<ReturnType<PermissionsService['getUserPermissions']>>;
  }> {
    const ctx = await this.authUtils.getBetterAuthContext();
    const session = await ctx.internalAdapter.createSession(String(userId));
    if (!session) throw new UnauthorizedException('Failed to create session');

    try {
      const permissions = await this.permissionsService.getUserPermissions(userId);
      const userRoles = permissions.roles || [];

      const user = await this.authUsersRepository.findEmailAndGuuid(userId);
      if (!user?.guuid) {
        throw new InternalServerErrorException(
          'User record missing guuid — cannot sign JWT',
        );
      }

      const roleHash = this.authUtils.hashRoles(userRoles);

      type DeviceType = 'IOS' | 'ANDROID' | 'WEB';
      const VALID: readonly DeviceType[] = ['IOS', 'ANDROID', 'WEB'];
      const rawType = deviceInfo?.deviceType?.toUpperCase() as DeviceType | undefined;
      const validatedDeviceType: DeviceType | null =
        rawType && VALID.includes(rawType) ? rawType : null;

      const ipHash = deviceInfo?.ipAddress
        ? crypto
            .createHmac('sha256', this.ipHmacSecret)
            .update(deviceInfo.ipAddress)
            .digest('hex')
        : null;

      const updatedSession = await this.sessionsRepository.updateByToken(session.token, {
        roleHash,
        ...(deviceInfo
          ? {
              deviceId: deviceInfo.deviceId || null,
              deviceName: deviceInfo.deviceName || null,
              deviceType: validatedDeviceType,
              appVersion: deviceInfo.appVersion || null,
              ipAddress: deviceInfo.ipAddress || null,
              userAgent: deviceInfo.userAgent || null,
              ipHash,
            }
          : {}),
      });

      const sessionGuuid = updatedSession?.guuid ?? '';

      let jwtToken: string | null = null;
      const jti = crypto.randomUUID();
      try {
        jwtToken = this.jwtConfigService.signToken({
          sub: user.guuid,
          sid: sessionGuuid,
          jti,
          ...(user.email ? { email: user.email } : {}),
          roles: userRoles.map((r) => r.roleCode),
          iss: 'nks-auth',
          aud: JWT_AUDIENCE,
        });

        // Persist the jti on the session row so it can be blocklisted on revocation.
        await this.sessionsRepository.updateByToken(session.token, { jti });
      } catch (jwtErr) {
        this.logger.error(`Failed to generate RS256 JWT: ${jwtErr}`);
      }

      this.logger.log(`Session created for user ${userId} with RS256 JWT.`);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid,
        jwtToken: jwtToken || undefined,
        userRoles,
        userEmail: user.email || '',
        permissions,
      };
    } catch (err) {
      this.logger.error(`Failed to embed roles/JWT into session: ${err}`);
      throw err;
    }
  }

}
