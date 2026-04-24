import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { SessionAuthValidator } from '../../validators';
import { InternalServerException } from '../../../../../common/exceptions';
import { ConfigService } from '@nestjs/config';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { SessionMapper } from '../../mapper/session.mapper';
import { SessionValidator, DeviceTypeEnum } from '../../../../../common/validators/session.validator';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { JtiBlocklistService } from '../token/jti-blocklist.service';
import { RevokedDevicesRepository } from '../../repositories/revoked-devices.repository';
import type { UserRoleEntry } from '../../mapper/auth-mapper';
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
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly ipHmacSecret: string;

  constructor(
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly authUtils: AuthUtilsService,
    private readonly jtiBlocklist: JtiBlocklistService,
    private readonly revokedDevicesRepository: RevokedDevicesRepository,
  ) {
    this.ipHmacSecret = this.configService.getOrThrow<string>('IP_HMAC_SECRET');
  }

  // Cleanup logic moved to SessionCleanupService (single cron entry point).

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
      } as NewUserSession,
    );

    SessionAuthValidator.assertSessionCreated(session);

    this.logger.debug(
      `Session created for user ${input.userId} (device: ${input.deviceName})`,
    );

    return session;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<SessionInfoDto[]> {
    const sessions = await this.sessionsRepository.findActiveByUserId(userId);
    return sessions.map(SessionMapper.buildSessionInfoDtoFromRow);
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
        this.jtiBlocklist.block(session.jti).catch((err: unknown) => {
          this.logger.error(`Failed to blocklist JTI on logout: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
      await this.invalidateSession(session.id);
    }
  }

  /**
   * Terminate a specific session (admin/user action)
   */
  async terminateSession(userId: number, sessionGuuid: string): Promise<void> {
    const session = await this.sessionsRepository.findByGuuid(sessionGuuid);

    // Session already gone — treat as success (idempotent delete).
    if (!session) return;

    SessionAuthValidator.assertSessionBelongsToUser(session, userId);

    if (session.jti) {
      this.jtiBlocklist.block(session.jti).catch((err: unknown) => {
        this.logger.error(`Failed to blocklist JTI on terminate: ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    // If the session had a deviceId, revoke it so offline pushes from that device
    // are rejected even while the 3-day offline HMAC signature is still valid.
    if (session.deviceId) {
      this.revokedDevicesRepository
        .revoke(session.userId, session.deviceId, userId)
        .catch((err: unknown) => {
          this.logger.error(
            `Failed to record device revocation for session ${session.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    await this.invalidateSession(session.id);
    this.logger.debug(`Session terminated by user: ${session.id}`);
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

  // ─── BetterAuth Session Creation ──────────────────────────────────────────

  /**
   * Create a BetterAuth session for a user and embed roles + JWT into it.
   * Called by AuthFlowOrchestrator and AuthService.rotateSession.
   */
  async createSessionForUser(
    userId: number,
    deviceInfo?: DeviceInfo,
  ): Promise<{
    token: string;
    expiresAt: Date;
    sessionGuuid: string;
    jti: string;
    userRoles: UserRoleEntry[];
    userEmail: string;
    permissions: Awaited<ReturnType<PermissionsService['getUserPermissions']>>;
  }> {
    // BREAKING: tied to better-auth@^1.6.2 internalAdapter API.
    // internalAdapter is undocumented. If createSession changes on a BetterAuth
    // upgrade, this will fail at runtime with no TS error.
    const ctx = await this.authUtils.getBetterAuthContext();
    const session = await ctx.internalAdapter.createSession(String(userId));
    SessionAuthValidator.assertSessionCreated(session);

    try {
      const permissions = await this.permissionsService.getUserPermissions(userId);
      const userRoles = permissions.roles ?? [];

      const user = await this.authUsersRepository.findEmailAndGuuid(userId);
      if (!user?.guuid) {
        throw new InternalServerException(
          'User record missing guuid — cannot sign JWT',
        );
      }

      const roleHash = this.authUtils.hashRoles(userRoles);

      const rawType = deviceInfo?.deviceType?.toUpperCase();
      const validatedDeviceType =
        rawType && Object.values(DeviceTypeEnum).includes(rawType as DeviceTypeEnum)
          ? (rawType as DeviceTypeEnum)
          : null;

      const ipHash = deviceInfo?.ipAddress
        ? crypto
            .createHmac('sha256', this.ipHmacSecret)
            .update(deviceInfo.ipAddress)
            .digest('hex')
        : null;

      // Auto-populate activeStoreFk from user's defaultStoreFk.
      // Validate the user still has a role in that store before trusting it.
      const defaultStoreId = user.defaultStoreFk ?? null;
      const activeStoreFk =
        defaultStoreId !== null &&
        userRoles.some((r) => r.storeId === defaultStoreId)
          ? defaultStoreId
          : null;

      const jti = crypto.randomUUID();

      const updatedSession = await this.sessionsRepository.updateByToken(session.token, {
        roleHash,
        activeStoreFk,
        jti,
        ...(deviceInfo
          ? {
              deviceId: deviceInfo.deviceId ?? null,
              deviceName: deviceInfo.deviceName ?? null,
              deviceType: validatedDeviceType,
              appVersion: deviceInfo.appVersion ?? null,
              ipAddress: deviceInfo.ipAddress ?? null,
              userAgent: deviceInfo.userAgent ?? null,
              ipHash,
            }
          : {}),
      });

      if (!updatedSession?.guuid) {
        throw new InternalServerException(
          'Session update failed — cannot proceed without session guuid',
        );
      }
      const sessionGuuid = updatedSession.guuid;

      this.logger.log(`Session created for user ${userId}.`);

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        sessionGuuid,
        jti,
        userRoles,
        userEmail: user.email ?? '',
        permissions,
      };
    } catch (err) {
      this.logger.error(`Failed to embed roles/JWT into session: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

}
