import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { signOfflineSession } from '../../../../../common/utils/offline-session-hmac';
import { JWTConfigService, JWTPayload } from '../../../../../config/jwt.config';
import { RoleQueryService } from '../../../roles/role-query.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { TokenPairGeneratorService } from './token-pair-generator.service';
import { AuthMapper, type TokenPair } from '../../mapper/auth-mapper';
import type { AuthResponseEnvelope } from '../../dto';
import {
  JWT_AUDIENCE,
  OFFLINE_JWT_TTL_DAYS,
  OFFLINE_JWT_EXPIRATION,
  REFRESH_TOKEN_TTL_MS,
} from '../../auth.constants';
import { SystemRoleCodes } from '../../../../../common/constants/system-role-codes.constant';

/**
 * TokenService — auth response assembly and session coordination.
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
 *   createTokenPair    — delegates to TokenPairGeneratorService for token generation
 *   buildAuthResponse  — full AuthResponseEnvelope (permissions, offline token, HMAC)
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly tokenPairGenerator: TokenPairGeneratorService,
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
   * Delegates to TokenPairGeneratorService for token generation and persistence.
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
    return this.tokenPairGenerator.generateTokenPair(
      userGuuid,
      sessionGuuid,
      sessionToken,
      userRoles,
      userEmail,
      jti,
      iamUserId,
      firstName,
      lastName,
    );
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
