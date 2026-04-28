import * as crypto from 'crypto';
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
import { AuthMapper } from '../../mapper/auth-mapper';
import type { AuthResponseEnvelope } from '../../dto/auth-response.dto';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';
import {
  ErrorCode,
  errPayload,
} from '../../../../../common/constants/error-codes.constants';
import { AuditCommandService } from '../../../../compliance/audit/audit-command.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SessionEvents } from '../../../../../common/events/session.events';

/**
 * TokenLifecycleService
 *
 * Owns the token rotation flow:
 *   - refreshAccessToken — validate refresh token, rotate session, issue new token pair
 *
 * Security-critical and intentionally isolated from the initial login/register
 * flows in PasswordAuthService.
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
    private readonly auditService: AuditCommandService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async refreshAccessToken(
    refreshToken: string,
    deviceId: string | null = null,
  ): Promise<AuthResponseEnvelope & { permissionsChanged: boolean }> {
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
      // Fan out full session cleanup off the hot path — the compromised session is
      // already marked (refreshTokenRevokedAt set), so further reuse is rejected
      // before the listener fires. Other sessions are cleaned up asynchronously.
      this.eventEmitter.emit(SessionEvents.REVOKE_ALL_FOR_USER, {
        userId: session.userId,
        reason: 'TOKEN_REUSE',
      });
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

    // Permission change detection — compare current role hash against the hash stored
    // at session creation time. A mismatch means roles were added/removed while this
    // session was active. Returned to caller so the client can refresh its permission
    // snapshot. Named permissionsChanged (not rolesChanged) to cover entity-permission
    // changes in future when a broader hash is introduced.
    const permissionsChanged =
      session.roleHash !== null && currentRoleHash !== session.roleHash;
    if (permissionsChanged) {
      this.logger.warn(
        `Permissions changed for user ${session.userId} during token refresh (session ${session.id}). Client will receive permissionsChanged=true.`,
      );
    }

    // Step 5: Generate new refresh token (in-memory only, not yet persisted).
    const { token: newRefreshToken, tokenHash: newRefreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();
    const newRefreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const newCsrfSecret = crypto.randomBytes(32).toString('hex');

    // Step 6: Rotate refresh token in-place — update the existing session row.
    // Re-validate activeStoreFk — user's role in that store may have been revoked since last login.
    // CAS: WHERE refreshTokenHash = oldHash ensures a concurrent refresh that already
    // replaced the hash will cause 0 rows matched → race detected, not theft.
    // IMPORTANT: JWT is signed AFTER this succeeds to prevent orphaned tokens.
    const validatedActiveStoreFk =
      session.activeStoreFk !== null &&
      userRoles.some((r) => r.storeId === session.activeStoreFk)
        ? session.activeStoreFk
        : null;

    const rotated = await this.sessionsRepository.rotateRefreshTokenInPlace(
      session.id,
      refreshTokenHash,
      {
        roleHash: currentRoleHash,
        activeStoreFk: validatedActiveStoreFk,
        refreshTokenHash: newRefreshTokenHash,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
        accessTokenExpiresAt,
        csrfSecret: newCsrfSecret,
      },
    );

    // assertRotationSucceeded throws if rotated === false.
    // JWT is signed below only after this line confirms the DB row was updated —
    // no orphaned token possible. The warn log is intentionally kept before the
    // throw so the race is observable in logs before the request is rejected.
    if (!rotated) {
      this.logger.warn(
        `Refresh race detected for session ${session.id} — another refresh already completed`,
      );
    }
    TokenLifecycleValidator.assertRotationSucceeded(rotated); // throws if false

    // Step 7: Sign JWT only after rotation is confirmed in DB.
    // Signing before rotation risks an orphaned JWT that passes AuthGuard
    // but has no live session backing it.
    const accessToken = this.jwtConfigService.signToken({
      sub: user.guuid,
      sid: session.guuid,
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

    const envelope = AuthMapper.buildAuthResponseEnvelope(
      {
        user: {
          id: session.userId,
          guuid: user.guuid,
          iamUserId: user.iamUserId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        },
        token: session.token,
      },
      {
        accessToken: accessToken,
        refreshToken: newRefreshToken,
        jwtExpiresAt: accessTokenExpiresAt,
        refreshTokenExpiresAt: newRefreshTokenExpiresAt,
      },
      primaryStore ?? null,
      session.guuid,
      accessTokenExpiresAt,
      newRefreshTokenExpiresAt,
      offlineToken,
      undefined,
      deviceId ?? undefined,
      { lastSyncedAt: new Date() },
    );

    return { ...envelope, permissionsChanged };
  }

}
