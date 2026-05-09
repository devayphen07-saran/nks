import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  UnauthorizedException,
  InternalServerException,
  TooManyRequestsException,
} from '../../../../../common/exceptions';

import { TokenService } from './token.service';
import { OfflineTokenService } from './offline-token.service';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { TokenTheftDetectionService } from './token-theft-detection.service';
import { DeviceRegistrationService } from '../device/device-registration.service';
import { RateLimitService } from '../../../../../common/guards/services/rate-limit.service';

import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  MAX_SESSION_TOKEN_LENGTH,
  REFRESH_RATE_LIMIT_PER_USER,
  REFRESH_RATE_LIMIT_WINDOW_MS,
} from '../../auth.constants';

import { AuthMapper } from '../../mapper/auth-mapper';
import type { UserRoleEntry, PermissionContext } from '../../mapper/auth-mapper';
import type { AuthResponseEnvelope } from '../../dto';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import type { UserSession } from '../../../../../core/database/schema/auth/user-session';

interface UserRow {
  guuid: string;
  iamUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  defaultStoreFk: number | null; // resolved from store.is_default = true
}

interface RotationResult {
  newRefreshToken: string;
  newBearerToken: string;
  accessExpiry: Date;
  refreshExpiry: Date;
}

@Injectable()
export class TokenLifecycleService {
  private readonly logger = new Logger(TokenLifecycleService.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly offlineTokenService: OfflineTokenService,
    private readonly sessionRepo: SessionTokenRepository,
    private readonly usersRepo: AuthUsersRepository,
    private readonly roleQuery: RoleQueryService,
    private readonly permissionsService: PermissionsService,
    private readonly authUtils: AuthUtilsService,
    private readonly theftService: TokenTheftDetectionService,
    private readonly deviceRegistration: DeviceRegistrationService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async refreshAccessToken(
    refreshToken: string,
    deviceId: string | null = null,
    isMobile = false,
  ): Promise<{ envelope: AuthResponseEnvelope; csrfSecret: string }> {
    if (!refreshToken || refreshToken.length > MAX_SESSION_TOKEN_LENGTH) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await this.loadAndVerifySession(hash);

    await this.enforceRateLimit(session.userId);
    this.assertNotStolen(session);
    this.assertSessionState(session, deviceId);

    const [[permissions, user], rotation] = await Promise.all([
      this.loadUserAndPermissions(session.userId),
      this.rotateSession(session, hash),
    ]);

    const roles = permissions.roles ?? [];
    const activeStoreId = AuthUtilsService.resolveStoreIfMember(session.activeStoreFk, roles);
    const primaryStore = await this.resolvePrimaryStore(user, session, roles);
    const offline = this.offlineTokenService.buildIfMobile(
      { userId: session.userId, guuid: user.guuid, iamUserId: user.iamUserId, email: user.email },
      session.guuid,
      roles,
      activeStoreId,
      isMobile,
    );

    this.logger.log(`Session rotated for user ${session.userId}`);

    // Refresh is the natural self-heal point for device registration:
    // every cold start that begins with a persisted session triggers a
    // refresh, every reconnection runs one, every 5-min proactive cycle
    // runs one. Idempotent UPSERT — safe to run on every rotation. If the
    // device row was missing (different device, lost row, or the rare bug
    // where a login flow skipped registration), it's restored here.
    if (deviceId && activeStoreId !== null) {
      try {
        await this.deviceRegistration.registerDevice(
          session.userId,
          activeStoreId,
          deviceId,
        );
      } catch (err) {
        this.logger.error(
          `Device re-registration on refresh failed for session ${session.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const envelope = AuthMapper.buildAuthResponseEnvelope({
      authResult: {
        user: {
          id: session.userId,
          guuid: user.guuid,
          iamUserId: user.iamUserId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        bearerToken: rotation.newBearerToken,
      },
      tokenPair: {
        refreshToken: rotation.newRefreshToken,
        jwtExpiresAt: rotation.accessExpiry,
        refreshTokenExpiresAt: rotation.refreshExpiry,
      },
      defaultStore: primaryStore,
      sessionId: session.guuid,
      sessionExpiresAt: session.expiresAt,
      refreshTokenExpiresAt: rotation.refreshExpiry,
      offline,
    });

    return { envelope, csrfSecret: session.csrfSecret };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async loadAndVerifySession(hash: string): Promise<UserSession> {
    const session = await this.sessionRepo.findByRefreshTokenHashForUpdate(hash);
    if (!session) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
    }
    return session;
  }

  private async enforceRateLimit(userId: number): Promise<void> {
    const hits = await this.rateLimitService.recordHit(
      `rl:user-refresh:${userId}`,
      REFRESH_RATE_LIMIT_WINDOW_MS,
    );
    if (hits > REFRESH_RATE_LIMIT_PER_USER) {
      throw new TooManyRequestsException({
        message: 'Too Many Requests',
        meta: { retryAfter: Math.ceil(REFRESH_RATE_LIMIT_WINDOW_MS / 1000) },
      });
    }
  }

  private assertNotStolen(session: UserSession): void {
    const stolen = this.theftService.detectAndHandleTheft(session);
    if (stolen && session.refreshTokenRevokedAt) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_COMPROMISED));
    }
  }

  private assertSessionState(session: UserSession, deviceId: string | null): void {
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_EXPIRED));
    }
    if (session.deviceId !== null && session.deviceId !== deviceId) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_DEVICE_MISMATCH));
    }
    if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt < new Date()) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED));
    }
  }

  private async loadUserAndPermissions(userId: number): Promise<[PermissionContext, UserRow]> {
    const [permissions, user] = await Promise.all([
      this.permissionsService.getUserPermissions(userId),
      this.usersRepo.findEmailAndGuuid(userId),
    ]);
    if (!user?.guuid) {
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }
    return [permissions, user];
  }

  private async rotateSession(session: UserSession, oldHash: string): Promise<RotationResult> {
    const { token: newRefreshToken, tokenHash } = this.tokenService.generateRefreshToken();
    const { token: newBearerToken } = this.tokenService.generateRefreshToken();
    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const rotated = await this.sessionRepo.rotateRefreshTokenInPlace(session.id, oldHash, {
      token: newBearerToken,
      activeStoreFk: session.activeStoreFk,
      refreshTokenHash: tokenHash,
      refreshTokenExpiresAt: refreshExpiry,
      accessTokenExpiresAt: accessExpiry,
    });

    if (!rotated) {
      this.logger.warn(`Refresh CAS conflict for session ${session.id} — concurrent refresh won`);
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_SESSION_ROTATION_FAILED));
    }

    return { newRefreshToken, newBearerToken, accessExpiry, refreshExpiry };
  }

  private async resolvePrimaryStore(
    user: UserRow,
    session: UserSession,
    roles: UserRoleEntry[],
  ): Promise<{ id: number; guuid: string } | null> {
    // Prefer the session's active store (set by switch-store) over the user's default.
    const storeId = session.activeStoreFk ?? user.defaultStoreFk;
    if (!storeId || !roles.some((r) => r.storeId === storeId)) return null;
    const roleId = await this.authUtils.getCachedSystemRoleId(SystemRoleCodes.STORE_OWNER);
    if (!roleId) return null;
    return this.roleQuery.findPrimaryStoreForUser(session.userId, roleId);
  }
}
