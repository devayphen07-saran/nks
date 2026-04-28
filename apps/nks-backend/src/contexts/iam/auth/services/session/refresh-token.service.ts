import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Refresh Token Service
 * Centralizes refresh token generation and validation.
 *
 * SECURITY: Tokens are fully opaque — no session UUID or structure exposed.
 * Lookup uses token hash, not decoded values.
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  /**
   * Generate new refresh token (fully opaque).
   * Used during token rotation to create the next refresh token.
   *
   * SECURITY:
   * - Token is 32 random bytes (~256 bits entropy) in base64url
   * - No session info embedded (prevents UUID exposure)
   * - Hash is stored in DB for constant-time lookup
   *
   * @returns {token, tokenHash} - Opaque token for client, SHA256 hash for DB lookup
   */
  generateRefreshToken(): { token: string; tokenHash: string } {
    // Generate 32-byte random token (256 bits of entropy)
    const randomToken = crypto.randomBytes(32).toString('base64url');

    // Hash for database storage and lookup
    const tokenHash = crypto
      .createHash('sha256')
      .update(randomToken)
      .digest('hex');

    return { token: randomToken, tokenHash };
  }

  /**
   * Verify refresh token hash.
   * Ensures token wasn't forged or tampered with.
   *
   * @param token - Refresh token from client
   * @param storedHash - SHA256 hash stored in database
   * @returns true if hash matches (token is valid)
   */
  verifyTokenHash(token: string, storedHash: string | null): boolean {
    if (!storedHash || !token) {
      return false;
    }

    const computedHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(computedHash, 'hex'),
        Buffer.from(storedHash, 'hex'),
      );
    } catch {
      // timingSafeEqual throws if lengths don't match
      return false;
    }
  }
}
