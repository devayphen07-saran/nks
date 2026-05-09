import { Injectable, Logger } from '@nestjs/common';
import { generateRefreshToken, verifyRefreshTokenHash } from '../../../../../common/utils/refresh-token.util';
import { JWTConfigService, JWTPayload } from '../../../../../config/jwt.config';
import { SessionTokenRepository } from '../../repositories/session-token.repository';
import type { TokenPair } from '../../mapper/auth-mapper';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from '../../auth.constants';

/**
 * TokenService — pure token issuance: JWT signing, refresh token generation/verification,
 * and token-pair persistence.
 *
 * Token taxonomy:
 *   refresh token  — opaque 32-byte base64url; rotated on every use; 7-day TTL.
 *   offline JWT    — RS256, 3-day TTL; mobile-only; verifiable without network.
 *
 * Rotation lives in TokenLifecycleService — that flow is security-critical
 * (CAS, theft detection, per-user rate limit) and intentionally separated.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtConfigService: JWTConfigService,
    private readonly sessionTokenRepository: SessionTokenRepository,
  ) {}

  // ─── JWT signing ──────────────────────────────────────────────────────────

  createAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>): string {
    return this.jwtConfigService.signToken(payload);
  }

  // ─── Refresh token (opaque) ───────────────────────────────────────────────

  /**
   * 32 random bytes → base64url for the client, sha256 hex for DB storage.
   * No session info embedded — lookup is by hash, not by decoded value.
   */
  generateRefreshToken(): { token: string; tokenHash: string } {
    return generateRefreshToken();
  }

  /** Timing-safe comparison of a precomputed hex hash against the stored hash. */
  verifyRefreshTokenHash(computedHash: string, storedHash: string | null): boolean {
    return verifyRefreshTokenHash(computedHash, storedHash);
  }

  // ─── Token pair (login / register / OTP) ──────────────────────────────────

  /**
   * Issue an opaque refresh token and persist its hash to the session row.
   * accessTokenExpiresAt is still written to the DB for session management.
   * Refresh-token rotation lives in TokenLifecycleService.
   */
  async createTokenPair(opts: {
    sessionToken: string;
  }): Promise<TokenPair> {
    const { sessionToken } = opts;

    const { token: refreshToken, tokenHash: refreshTokenHash } = this.generateRefreshToken();
    const now = new Date();
    const jwtExpiresAt = new Date(now.getTime() + ACCESS_TOKEN_TTL_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);

    await this.sessionTokenRepository.setRefreshTokenData(sessionToken, {
      refreshTokenHash,
      refreshTokenExpiresAt,
      accessTokenExpiresAt: jwtExpiresAt,
    });

    return { refreshToken, jwtExpiresAt, refreshTokenExpiresAt };
  }
}
