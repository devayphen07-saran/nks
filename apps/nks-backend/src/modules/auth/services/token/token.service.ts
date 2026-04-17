import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JWTConfigService, JWTPayload } from '../../../../config/jwt.config';
import { RefreshTokenService } from '../session/refresh-token.service';
import { SessionsRepository } from '../../repositories/sessions.repository';
import { RolesRepository } from '../../../roles/repositories/roles.repository';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthUtilsService } from '../shared/auth-utils.service';
import { AuthMapper, type TokenPair } from '../../mappers/auth-mapper';
import type { SessionUserRole } from '../../interfaces/session-user.interface';
import type { AuthResponseEnvelope } from '../../dto';
import {
  JWT_AUDIENCE,
  OFFLINE_JWT_TTL_DAYS,
  OFFLINE_JWT_EXPIRATION,
  SYSTEM_ROLE_STORE_OWNER,
} from '../../auth.constants';

/**
 * TokenService
 *
 * Owns token creation and auth response assembly:
 *   - createAccessToken  — raw RS256 JWT wrapper
 *   - createTokenPair    — JWT + opaque refresh token, stored in session
 *   - buildAuthResponse  — full AuthResponseEnvelope (permissions, offline token, HMAC)
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly authUtils: AuthUtilsService,
  ) {}

  // ─── Existing API ─────────────────────────────────────────────────────────

  createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>): string {
    try {
      const token = this.jwtConfigService.signToken(payload);
      this.logger.debug(`Access token created for user ${payload.sub}`);
      return token;
    } catch (error) {
      this.logger.error('Failed to create access token', error);
      throw error;
    }
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      return this.jwtConfigService.verifyToken(token);
    } catch (error) {
      this.logger.warn('Access token verification failed');
      throw error;
    }
  }

  decodeToken(token: string): JWTPayload | null {
    if (!token) return null;
    try {
      return this.jwtConfigService.decodeToken(token);
    } catch {
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
    userRoles: SessionUserRole[],
    userEmail: string,
    sessionGuuid: string,
  ): Promise<TokenPair> {
    const jwtToken = this.jwtConfigService.signToken({
      sub: userGuuid,
      sid: sessionGuuid,
      jti: crypto.randomUUID(),
      ...(userEmail ? { email: userEmail } : {}),
      roles: userRoles.map((r) => r.roleCode),
      iss: 'nks-auth',
      aud: JWT_AUDIENCE,
    });

    const { token: refreshToken, tokenHash: refreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();

    const now = new Date();
    const jwtExpiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 min
    const refreshTokenExpiresAt = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    ); // 7d

    await this.sessionsRepository.setRefreshTokenData(sessionToken, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      accessTokenExpiresAt: jwtExpiresAt,
    });

    this.logger.log(
      `Token pair created for ${userGuuid}. Access: 15 min. Refresh: 7 days.`,
    );

    return { jwtToken, refreshToken, jwtExpiresAt, refreshTokenExpiresAt };
  }

  // ─── Auth Response Assembly ────────────────────────────────────────────────

  /**
   * Assemble the AuthResponseEnvelope used by login, register, and OTP flows.
   */
  async buildAuthResponse(
    user: {
      id: number;
      guuid?: string | null;
      email: string | null;
      name: string;
      emailVerified: boolean;
      image: string | null | undefined;
      phoneNumber: string | null | undefined;
      phoneNumberVerified: boolean;
    },
    token: string,
    expiresAt: Date,
    tokenPair?: TokenPair,
    cachedPermissions?: Awaited<
      ReturnType<PermissionsService['getUserPermissions']>
    >,
  ): Promise<AuthResponseEnvelope> {
    const sessionId = crypto.randomUUID();
    const refreshExpiresAt =
      tokenPair?.refreshTokenExpiresAt ??
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const storeOwnerRoleId = await this.authUtils.getCachedSystemRoleId(
      SYSTEM_ROLE_STORE_OWNER,
    );
    const primaryStore = storeOwnerRoleId
      ? await this.rolesRepository.findPrimaryStoreForUser(
          user.id,
          storeOwnerRoleId,
        )
      : null;

    const permissions =
      cachedPermissions ??
      (await this.permissionsService.getUserPermissions(user.id));

    const primaryStoreId = permissions.roles.find((r) => r.isPrimary && r.storeId)?.storeId ?? null;

    const offlineToken = this.jwtConfigService.signOfflineToken(
      {
        sub: user.guuid ?? '',
        ...(user.email ? { email: user.email } : {}),
        roles: permissions.roles.map((r) => r.roleCode),
        stores: permissions.roles
          .filter((r) => r.storeId && r.storeName)
          .map((r) => ({
            id: r.storeId as number,
            name: r.storeName as string,
          })),
        activeStoreId: primaryStoreId,
      },
      OFFLINE_JWT_EXPIRATION,
    );

    const offlineSessionSignature = this.signOfflineSessionPayload({
      userId: user.id,
      storeId: primaryStoreId,
      roles: permissions.roles.map((r) => r.roleCode),
      offlineValidUntil:
        Date.now() + OFFLINE_JWT_TTL_DAYS * 24 * 60 * 60 * 1000,
    });

    return AuthMapper.toAuthResponseEnvelope(
      {
        user: {
          id: user.id,
          guuid: user.guuid ?? '',
          email: user.email,
          name: user.name,
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
    );
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private signOfflineSessionPayload(payload: {
    userId: number;
    storeId: number | null;
    roles: string[];
    offlineValidUntil: number;
  }): string | undefined {
    const secret = this.configService.getOrThrow<string>(
      'OFFLINE_SESSION_HMAC_SECRET',
    );
    const data = JSON.stringify({
      userId: payload.userId,
      storeId: payload.storeId,
      roles: [...payload.roles].sort(),
      offlineValidUntil: payload.offlineValidUntil,
    });
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
