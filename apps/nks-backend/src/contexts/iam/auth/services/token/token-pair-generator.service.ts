import { Injectable, Logger } from '@nestjs/common';
import { JWTConfigService, JWTPayload } from '../../../../../config/jwt.config';
import { RefreshTokenService } from '../session/refresh-token.service';
import { SessionsRepository } from '../../repositories/sessions.repository';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  JWT_AUDIENCE,
} from '../../auth.constants';
import type { TokenPair } from '../../mapper/auth-mapper';

/**
 * TokenPairGeneratorService — generates and persists JWT + refresh token pairs.
 *
 * Single Responsibility:
 *   - Create RS256 access token from user context
 *   - Generate opaque refresh token
 *   - Persist refresh token hash and expiry to session
 *   - Return token pair with expiry timestamps
 *
 * Dependencies (2):
 *   - jwtConfigService: RS256 token signing
 *   - refreshTokenService: Opaque refresh token generation
 *   - sessionsRepository: Persist refresh token data
 */
@Injectable()
export class TokenPairGeneratorService {
  private readonly logger = new Logger(TokenPairGeneratorService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionsRepository: SessionsRepository,
  ) {}

  /**
   * Generate and persist a complete token pair (access JWT + refresh token).
   *
   * Process:
   *   1. Create RS256 access token with user identity and roles
   *   2. Generate opaque refresh token (32-byte random)
   *   3. Hash refresh token for secure DB storage
   *   4. Calculate expiry timestamps
   *   5. Persist refresh token hash to session row
   *   6. Return token pair with expiry metadata
   *
   * @param userGuuid — User GUUID (sub claim)
   * @param sessionGuuid — Session GUUID (sid claim)
   * @param sessionToken — Opaque session token (for DB lookup)
   * @param userRoles — User role array [{roleCode}, ...]
   * @param userEmail — User email (optional email claim)
   * @param jti — JWT ID (unique identifier)
   * @param iamUserId — Cross-service user ID
   * @param firstName — User first name (optional)
   * @param lastName — User last name (optional)
   * @returns TokenPair — {accessToken, refreshToken, jwtExpiresAt, refreshTokenExpiresAt}
   */
  async generateTokenPair(
    userGuuid: string,
    sessionGuuid: string,
    sessionToken: string,
    userRoles: Array<{ roleCode: string }>,
    userEmail: string,
    jti: string,
    iamUserId: string,
    firstName?: string,
    lastName?: string,
  ): Promise<TokenPair> {
    // Step 1: Create RS256 access token
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

    // Step 2 & 3: Generate and hash refresh token
    const { token: refreshToken, tokenHash: refreshTokenHash } =
      this.refreshTokenService.generateRefreshToken();

    // Step 4: Calculate expiry timestamps
    const now = new Date();
    const jwtExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

    // Step 5: Persist refresh token hash to session
    await this.sessionsRepository.setRefreshTokenData(sessionToken, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      accessTokenExpiresAt: jwtExpiresAt,
    });

    this.logger.log(
      `Token pair generated for ${userGuuid}. Access: 15 min. Refresh: 7 days.`,
    );

    // Step 6: Return complete pair
    return { accessToken, refreshToken, jwtExpiresAt, refreshTokenExpiresAt };
  }

  /**
   * Create RS256 access token.
   *
   * Internal helper — creates the JWT payload and signs it.
   * The signing key is managed by JWTConfigService with automatic rotation.
   *
   * @param payload — JWT payload (sub, sid, jti, roles, email, etc.)
   * @returns Signed RS256 JWT string
   */
  private createAccessToken(
    payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>,
  ): string {
    const token = this.jwtConfigService.signToken(payload);
    this.logger.debug(`Access token created for user ${payload.sub}`);
    return token;
  }
}
