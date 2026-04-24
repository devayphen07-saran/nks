import * as crypto from 'crypto';
import { JsonWebTokenError } from 'jsonwebtoken';
import { Injectable, Logger } from '@nestjs/common';
import { TokenLifecycleValidator } from '../../validators';
import {
  UnauthorizedException,
  InternalServerException,
} from '../../../../../common/exceptions';
import { JWTConfigService } from '../../../../../config/jwt.config';
import { RefreshTokenService } from '../session/refresh-token.service';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import {
  JWT_AUDIENCE,
  OFFLINE_JWT_EXPIRATION,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../../auth.constants';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import { AuditService } from '../../../../compliance/audit/audit.service';

export interface VerifyClaimsResponse {
  isValid: boolean;
  sub?: string;
  rolesChanged: boolean;
  currentRoles?: string[];
  stores?: Array<{ guuid: string | null; name: string | null }>;
}

/**
 * TokenLifecycleService
 *
 * Owns the token rotation and verification flows:
 *   - refreshAccessToken — validate refresh token, rotate session, issue new token pair
 *   - verifyClaims       — verify JWT signature and detect role changes
 *
 * These flows are security-critical and intentionally isolated from the
 * initial login/register flows in PasswordAuthService.
 */
@Injectable()
export class TokenLifecycleService {
  private readonly logger = new Logger(TokenLifecycleService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly roleQuery: RoleQueryService,
    private readonly permissionsService: PermissionsService,
    private readonly authUtils: AuthUtilsService,
    private readonly auditService: AuditService,
  ) {}

  async refreshAccessToken(
    refreshToken: string,
    deviceId: string | null = null,
  ): Promise<{
    sessionId: string;
    sessionToken: string;
    jwtToken: string;
    expiresAt: string;
    refreshToken: string;
    refreshExpiresAt: string;
    defaultStore: { guuid: string } | null;
    offlineToken: string;
    rolesChanged: boolean;
  }> {
    // Step 1: Reject oversized inputs before hashing to prevent DoS via large payloads.
    // base64url(32 bytes) = 43 chars; 512 gives headroom for future token format changes.
    if (!refreshToken || refreshToken.length > 512) {
      throw new UnauthorizedException(errPayload(ErrorCode.AUTH_REFRESH_TOKEN_INVALID));
    }

    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    // Step 2: Fetch session with EXCLUSIVE LOCK — prevents concurrent rotation races
    const session =
      await this.sessionsRepository.findByRefreshTokenHashForUpdate(
        refreshTokenHash,
      );
    TokenLifecycleValidator.assertRefreshTokenValid(session);

    const isValidToken = this.refreshTokenService.verifyTokenHash(
      refreshToken,
      session.refreshTokenHash,
    );
    TokenLifecycleValidator.assertTokenHashValid(isValidToken);

    // Step 2b: Theft detection — if token was already rotated, terminate all sessions
    if (session.refreshTokenRevokedAt !== null) {
      this.logger.error(
        `TOKEN THEFT DETECTED: User ${session.userId} reused rotated refresh token. Session ${session.id} compromised.`,
        {
          sessionId: session.id,
          revokedAt: session.refreshTokenRevokedAt,
          attemptedAt: new Date(),
        },
      );
      // Emit to audit trail — structured log alone is not enough: the audit
      // table is the security-facing record that compliance tools query.
      this.auditService.log({
        action: 'TOKEN_REVOKE',
        userId: session.userId,
        description: 'TOKEN THEFT: refresh token reused after rotation — all sessions force-terminated',
        severity: 'critical',
        resourceType: 'session',
        resourceId: session.id,
        metadata: {
          sessionId: session.id,
          revokedAt: session.refreshTokenRevokedAt,
          reason: 'TOKEN_THEFT_DETECTED',
        },
      });
      await this.sessionsRepository.revokeAndDeleteAllForUser(
        session.userId,
        'TOKEN_REUSE',
      );
      TokenLifecycleValidator.assertNotCompromised(
        session.refreshTokenRevokedAt,
      );
    }

    TokenLifecycleValidator.assertSessionNotExpired(session.expiresAt);

    // Step 3a: Device binding — mobile tokens must match device
    TokenLifecycleValidator.assertDeviceMatch(session.deviceId, deviceId);

    // Step 3b: Refresh token expiry
    TokenLifecycleValidator.assertRefreshTokenNotExpired(
      session.refreshTokenExpiresAt,
    );

    // Step 4: Fetch permissions + user in parallel
    const [permissions, user] = await Promise.all([
      this.permissionsService.getUserPermissions(session.userId),
      this.authUsersRepository.findEmailAndGuuid(session.userId),
    ]);

    if (!user?.guuid) {
      throw new InternalServerException(
        'User record missing guuid — cannot sign JWT',
      );
    }

    const userRoles = permissions.roles ?? [];
    const currentRoleHash = this.authUtils.hashRoles(userRoles);
    const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);

    // Role change detection — compare current role hash against the hash stored
    // at session creation time. A mismatch means an admin added/removed a role
    // while this session was active. Logged as a warning; returned to caller so
    // the client can refresh its permission snapshot without forcing re-login.
    const rolesChanged =
      session.roleHash !== null && currentRoleHash !== session.roleHash;
    if (rolesChanged) {
      this.logger.warn(
        `Roles changed for user ${session.userId} during token refresh (session ${session.id}). Client will receive rolesChanged=true.`,
      );
    }

    // Step 5: Rotate session — BetterAuth issues a new opaque token.
    // BREAKING: tied to better-auth@^1.6.2 internalAdapter API.
    // internalAdapter is undocumented. If createSession disappears or changes
    // signature on a BetterAuth upgrade, this will fail at runtime with no TS error.
    const ctx = await this.authUtils.getBetterAuthContext();
    const createdSession = await ctx.internalAdapter.createSession(
      String(session.userId),
    );
    TokenLifecycleValidator.assertSessionCreated(createdSession);

    const newSession = await this.sessionsRepository.findByToken(
      createdSession.token,
    );
    TokenLifecycleValidator.assertSessionCreated(newSession);

    // Step 6: Generate new refresh token (in-memory only, not yet persisted)
    const { token: newRefreshToken, tokenHash: newRefreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();
    const newRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Step 7: Atomically persist the new session + revoke the old refresh token.
    // Re-validate activeStoreFk — user's role in that store may have been revoked since last login.
    // IMPORTANT: JWT is signed AFTER this succeeds to prevent orphaned tokens.
    const validatedActiveStoreFk =
      session.activeStoreFk !== null &&
      userRoles.some((r) => r.storeId === session.activeStoreFk)
        ? session.activeStoreFk
        : null;

    const rotated = await this.sessionsRepository.rotateRefreshToken(
      newSession.id,
      {
        roleHash: currentRoleHash,
        deviceId: session.deviceId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        appVersion: session.appVersion,
        activeStoreFk: validatedActiveStoreFk,
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        accessTokenExpiresAt,
      },
      session.id,
    );

    // CAS returned false — another refresh already rotated this token.
    // This is a legitimate race (e.g. foreground + background refresh),
    // NOT token theft. Reject so the caller re-reads the current token.
    if (!rotated) {
      this.logger.warn(
        `Refresh race detected for session ${session.id} — another refresh already completed`,
      );
    }
    TokenLifecycleValidator.assertRotationSucceeded(rotated);

    // Step 8: Sign JWT only after session rotation is confirmed in DB.
    // Signing before rotation risks an orphaned JWT that passes AuthGuard
    // but has no live session backing it.
    const accessToken = this.jwtConfigService.signToken({
      sub: user.guuid,
      sid: newSession.guuid,
      jti: crypto.randomUUID(),
      iamUserId: user.iamUserId,
      ...(user.email ? { email: user.email } : {}),
      roles: userRoles.map((r) => r.roleCode),
      iss: 'nks-auth',
      aud: JWT_AUDIENCE,
    });

    // Step 9: Resolve default store from users.defaultStoreFk (persistent preference).
    // Validate user still has a role in that store before trusting it.
    const defaultStoreId = user.defaultStoreFk ?? null;
    const validatedDefaultStoreId =
      defaultStoreId !== null &&
      userRoles.some((r) => r.storeId === defaultStoreId)
        ? defaultStoreId
        : null;

    // Resolve guuid for the response using existing pattern.
    const storeOwnerRoleId = await this.authUtils.getCachedSystemRoleId(
      SystemRoleCodes.STORE_OWNER,
    );
    const primaryStore =
      storeOwnerRoleId && validatedDefaultStoreId
        ? await this.roleQuery.findPrimaryStoreForUser(
            session.userId,
            storeOwnerRoleId,
          )
        : null;

    const offlineToken = this.jwtConfigService.signOfflineToken(
      {
        sub: user.guuid,
        ...(user.email ? { email: user.email } : {}),
        roles: userRoles.map((r) => r.roleCode),
        stores: userRoles
          .filter((r) => r.storeGuuid && r.storeName)
          .map((r) => ({
            guuid: r.storeGuuid as string,
            name: r.storeName as string,
          })),
        activeStoreGuuid: primaryStore?.guuid ?? null,
      },
      OFFLINE_JWT_EXPIRATION,
    );

    this.logger.log(`Session rotated for user ${session.userId}`);

    return {
      sessionId: newSession.guuid,
      sessionToken: newSession.token,
      jwtToken: accessToken,
      expiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken: newRefreshToken,
      refreshExpiresAt: newRefreshTokenExpiresAt.toISOString(),
      defaultStore: primaryStore ? { guuid: primaryStore.guuid } : null,
      offlineToken,
      rolesChanged,
    };
  }

  async verifyClaims(jwtToken: string): Promise<VerifyClaimsResponse> {
    try {
      const payload = this.jwtConfigService.verifyToken(jwtToken);

      if (payload.aud !== JWT_AUDIENCE) {
        throw new UnauthorizedException(
          errPayload(ErrorCode.AUTH_INVALID_JWT_AUDIENCE),
        );
      }

      const user = await this.authUsersRepository.findByGuuid(payload.sub);
      if (!user)
        throw new UnauthorizedException(errPayload(ErrorCode.USER_NOT_FOUND));

      const currentPermissions =
        await this.permissionsService.getUserPermissions(user.id);
      const currentRoles = currentPermissions.roles ?? [];
      const currentRoleCodes = currentRoles.map((r) => r.roleCode);

      const tokenRoles = payload.roles ?? [];
      const rolesChanged = !this.arraysEqual(
        [...currentRoleCodes].sort(),
        [...tokenRoles].sort(),
      );

      this.logger.log(
        `JWT claims verified for ${payload.sub}. Roles changed: ${rolesChanged}`,
      );

      return {
        isValid: true,
        sub: payload.sub,
        rolesChanged,
        currentRoles: currentRoleCodes,
        stores: currentRoles
          .filter((r) => r.storeGuuid)
          .map((r) => ({ guuid: r.storeGuuid, name: r.storeName })),
      };
    } catch (error) {
      // Re-throw infrastructure failures (DB, permissions service) so the caller
      // gets a 500 rather than a silent isValid:false that masks the real problem.
      if (!(error instanceof JsonWebTokenError) && !(error instanceof UnauthorizedException)) {
        throw error;
      }
      this.logger.warn(`JWT verification failed: ${error instanceof Error ? error.message : String(error)}`);
      return { isValid: false, rolesChanged: false };
    }
  }

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
