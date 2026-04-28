import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signOfflineSession } from '../../../../../common/utils/offline-session-hmac';
import { JWTConfigService, JWTPayload } from '../../../../../config/jwt.config';
import { RefreshTokenService } from '../session/refresh-token.service';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { RoleQueryService } from '../../../roles/role-query.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { AuthMapper, type TokenPair } from '../../mapper/auth-mapper';
import type { AuthResponseEnvelope } from '../../dto';
import {
  JWT_AUDIENCE,
  OFFLINE_JWT_TTL_DAYS,
  OFFLINE_JWT_EXPIRATION,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../../auth.constants';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';

/**
 * TokenService — token creation and auth response assembly.
 *
 * Token lifecycle responsibilities:
 *   session token  — opaque 64-char hex; primary auth credential for cookie/bearer transport;
 *                    long-lived (30 days), rotated every 1h for web by SessionRotationService.
 *   access JWT     — RS256, 15-min TTL; short-lived authorization artifact for API calls;
 *                    never stored; signed from the session token's backing session row.
 *   refresh token  — opaque 32-byte base64url; used ONLY for token renewal; rotated
 *                    on every use (in-place, same session row); 7-day TTL.
 *   offline JWT    — RS256, 3-day TTL; mobile-only; verifiable without a network round trip.
 *
 * Methods:
 *   createAccessToken  — raw RS256 JWT wrapper
 *   createTokenPair    — access JWT + opaque refresh token stored in session
 *   buildAuthResponse  — full AuthResponseEnvelope (permissions, offline token, HMAC)
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly roleQuery: RoleQueryService,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  // ─── Existing API ─────────────────────────────────────────────────────────

  createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>): string {
    const token = this.jwtConfigService.signToken(payload);
    this.logger.debug(`Access token created for user ${payload.sub}`);
    return token;
  }

  verifyAccessToken(token: string): JWTPayload {
    return this.jwtConfigService.verifyToken(token);
  }

  decodeToken(token: string): JWTPayload | null {
    if (!token) return null;
    try {
      return this.jwtConfigService.decodeToken(token);
    } catch (err: unknown) {
      this.logger.debug(`Token decode failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ─── Token Pair ────────────────────────────────────────────────────────────

  /**
   * Create an RS256 access token + opaque refresh token pair.
   * Persists the refresh token hash to the session row.
   */
  async createTokenPair(
    userGuuid: string,
    sessionToken: string,
    userRoles: Array<{ roleCode: string }>,
    userEmail: string,
    sessionGuuid: string,
    jti: string,
    iamUserId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<TokenPair> {
    const accessToken = this.createAccessToken({
      sub: userGuuid,
      sid: sessionGuuid,
      jti,
      iamUserId,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(userEmail ? { email: userEmail } : {}),
      roles: userRoles.map((r) => r.roleCode),
      iss: 'nks-auth',
      aud: JWT_AUDIENCE,
    });

    const { token: refreshToken, tokenHash: refreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();

    const now = new Date();
    const jwtExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

    await this.sessionsRepository.setRefreshTokenData(sessionToken, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      accessTokenExpiresAt: jwtExpiresAt,
    });

    this.logger.log(
      `Token pair created for ${userGuuid}. Access: 15 min. Refresh: 7 days.`,
    );

    return { accessToken, refreshToken, jwtExpiresAt, refreshTokenExpiresAt };
  }

  // ─── Auth Response Assembly ────────────────────────────────────────────────

  /**
   * Assemble the AuthResponseEnvelope used by login, register, and OTP flows.
   */
  async buildAuthResponse(
    user: {
      id: number;
      guuid: string;
      iamUserId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      emailVerified: boolean;
      image: string | null | undefined;
      phoneNumber: string | null | undefined;
      phoneNumberVerified: boolean;
      defaultStoreFk?: number | null;
    },
    token: string,
    expiresAt: Date,
    sessionGuuid: string,
    tokenPair?: TokenPair,
    cachedPermissions?: Awaited<
      ReturnType<PermissionsService['getUserPermissions']>
    >,
    deviceId?: string,
  ): Promise<AuthResponseEnvelope> {
    const sessionId = sessionGuuid;
    const refreshExpiresAt =
      tokenPair?.refreshTokenExpiresAt ??
      new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    const permissions =
      cachedPermissions ??
      (await this.permissionsService.getUserPermissions(user.id));

    // Default store: from users.defaultStoreFk (persistent preference).
    // Validate the user still has a role in that store before trusting it.
    const defaultStoreId = user.defaultStoreFk ?? null;
    const primaryStoreId =
      defaultStoreId !== null &&
      permissions.roles.some((r) => r.storeId === defaultStoreId)
        ? defaultStoreId
        : null;

    // Resolve store guuid using existing repository pattern.
    const storeOwnerRoleId = await this.authUtils.getCachedSystemRoleId(
      SystemRoleCodes.STORE_OWNER,
    );
    const primaryStore = storeOwnerRoleId && primaryStoreId
      ? await this.roleQuery.findPrimaryStoreForUser(
          user.id,
          storeOwnerRoleId,
        )
      : null;

    const offlineToken = this.jwtConfigService.signOfflineToken(
      {
        sub: user.guuid,
        ...(user.email ? { email: user.email } : {}),
        roles: permissions.roles.map((r) => r.roleCode),
        stores: permissions.roles
          .filter((r) => r.storeGuuid && r.storeName)
          .map((r) => ({
            guuid: r.storeGuuid as string,
            name: r.storeName as string,
          })),
        activeStoreGuuid: primaryStore?.guuid ?? null,
      },
      OFFLINE_JWT_EXPIRATION,
    );

    const offlineSessionSecret = this.configService.getOrThrow<string>(
      'OFFLINE_SESSION_HMAC_SECRET',
    );
    const offlineSessionSignature = signOfflineSession(
      {
        userGuuid: user.guuid,
        storeGuuid: primaryStore?.guuid ?? null,
        roles: permissions.roles.map((r) => r.roleCode),
        offlineValidUntil:
          Date.now() + OFFLINE_JWT_TTL_DAYS * 24 * 60 * 60 * 1000,
      },
      offlineSessionSecret,
    );

    return AuthMapper.buildAuthResponseEnvelope(
      {
        user: {
          id: user.id,
          guuid: user.guuid,
          iamUserId: user.iamUserId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber ?? null,
        },
        token,
        session: { token, expiresAt, sessionId },
      },
      tokenPair,
      primaryStore ? { guuid: primaryStore.guuid } : null,
      sessionId,
      expiresAt,
      refreshExpiresAt,
      offlineToken,
      offlineSessionSignature,
      deviceId,
    );
  }

}
