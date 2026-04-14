import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { RSAKeyManager } from '../core/crypto/rsa-keys';

export interface JWTPayload {
  sub: string;
  sid: string;
  jti: string;
  email?: string;
  roles: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid?: string;
}

/** Offline JWT payload — identity + authorization only, no session binding */
export interface OfflineJWTPayload {
  sub: string;
  jti: string;
  email?: string;
  roles: string[];
  stores: Array<{ id: number; name: string }>;
  activeStoreId: number | null;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid?: string;
}

// Track fallback keys for graceful key rotation (7-day grace period)
interface FallbackKey {
  kid: string;
  publicKeyPem: string;
  jwk: Record<string, any>;
  rotatedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class JWTConfigService {
  private readonly logger = new Logger(JWTConfigService.name);
  private privateKey: string;
  private publicKey: string;
  private currentKeyId: string = '';
  private fallbackKeys: FallbackKey[] = [];
  private readonly FALLBACK_KEY_DURATION_DAYS = 30; // 30-day grace period for offline clients

  constructor() {
    try {
      this.privateKey = RSAKeyManager.getPrivateKey();
      this.publicKey = RSAKeyManager.getPublicKey();
      this.logger.debug('✅ RSA keys loaded');

      // Compute kid as SHA-256 thumbprint of public key (RFC 7638)
      // This allows kid to automatically change on key rotation without hardcoding
      this.currentKeyId = this.computeKeyThumbprint(this.publicKey);
      this.logger.debug(`✅ Current key ID computed: ${this.currentKeyId.substring(0, 8)}...`);
    } catch (error) {
      this.logger.error('Failed to load RSA keys', error);
      throw error;
    }
  }

  /**
   * Compute SHA-256 thumbprint of RSA public key for kid field.
   * Enables automatic key rotation detection without hardcoded values.
   */
  private computeKeyThumbprint(publicKeyPem: string): string {
    const key = crypto.createPublicKey({ key: publicKeyPem, format: 'pem' });
    const derBuffer = key.export({ format: 'der', type: 'spki' });
    return crypto.createHash('sha256').update(derBuffer).digest('hex');
  }

  /**
   * Sign JWT with RS256 (backend only)
   * Works for both WEB and MOBILE
   * FIX #7: TTL aligned to 15 minutes (was 1 hour)
   */
  signToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 15 * 60; // 15 minutes (NKS spec)

    const tokenPayload: JWTPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn,
      kid: this.currentKeyId,
    };

    try {
      return jwt.sign(tokenPayload, this.privateKey, {
        algorithm: 'RS256',
        keyid: this.currentKeyId,
      });
    } catch (error) {
      this.logger.error('Failed to sign JWT', error);
      throw error;
    }
  }

  /**
   * Sign an offline JWT for mobile offline verification.
   * FIX #12: TTL is configurable via expiresIn parameter (default: 3 days for NKS).
   * The offline JWT's own exp claim IS the offline window boundary.
   * Mobile does NOT need a separate grace period calculation.
   * FIX #8: audience aligned to JWT_AUDIENCE ('nks-app'), was 'nks-offline'.
   */
  signOfflineToken(
    payload: {
      sub: string;
      email?: string;
      roles: string[];
      stores: Array<{ id: number; name: string }>;
      activeStoreId: number | null;
    },
    expiresIn: string = '3d',
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const seconds = this.parseExpiresIn(expiresIn);

    const tokenPayload: OfflineJWTPayload = {
      sub: payload.sub,
      jti: crypto.randomUUID(),
      ...(payload.email ? { email: payload.email } : {}),
      roles: payload.roles,
      stores: payload.stores,
      activeStoreId: payload.activeStoreId,
      iss: 'nks-auth',
      aud: 'nks-app',
      iat: now,
      exp: now + seconds,
      kid: this.currentKeyId,
    };

    try {
      return jwt.sign(tokenPayload, this.privateKey, {
        algorithm: 'RS256',
        keyid: this.currentKeyId,
      });
    } catch (error) {
      this.logger.error('Failed to sign offline JWT', error);
      throw error;
    }
  }

  /** Parse duration strings like '3d', '12h', '30m' to seconds */
  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([dhm])$/);
    if (!match) throw new Error(`Invalid expiresIn format: ${value}`);
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 'd': return num * 86400;
      case 'h': return num * 3600;
      case 'm': return num * 60;
      default:  return num;
    }
  }

  /**
   * Verify JWT with RS256 (backend + mobile offline)
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
      }) as JWTPayload;
    } catch (error) {
      this.logger.warn('JWT verification failed', error);
      throw error;
    }
  }

  /** Get the current key ID (for /nks-jwks endpoint) */
  getCurrentKid(): string {
    return this.currentKeyId;
  }

  /** Export the RSA public key in JWK format (for /nks-jwks endpoint) */
  getPublicKeyAsJwk(): Record<string, any> {
    const key = crypto.createPublicKey({ key: this.publicKey, format: 'pem' });
    return key.export({ format: 'jwk' }) as Record<string, any>;
  }

  /**
   * Get JWKS (for mobile to download)
   * Returns active key + fallback keys from past 30 days
   * WEB: Optional, MOBILE: Required (for offline JWT verification)
   *
   * Key Rotation Strategy:
   * 1. Active key: Used for new token signatures (kid = SHA-256 thumbprint of public key)
   * 2. Fallback keys: Kept for 30 days to allow graceful rotation for offline clients
   *    (offline JWT TTL = 3 days, so 30-day grace = 27-day buffer post-rotation)
   * 3. Cache: 1 hour (max-age=3600) for fast emergency rotation propagation
   * 4. If key is compromised: Generate new key, add to JWKS, remove old after 30 days
   */
  getPublicKeyAsJWKS(): Record<string, any> {
    // Clean up expired fallback keys
    this.cleanupExpiredFallbackKeys();

    const key = crypto.createPublicKey({
      key: this.publicKey,
      format: 'pem',
    });

    const jwk = key.export({ format: 'jwk' }) as Record<string, any>;
    const now = Math.floor(Date.now() / 1000);

    // Build keys array: active key first, then valid fallback keys
    const keysArray: Record<string, any>[] = [
      {
        ...jwk,
        kid: this.currentKeyId,
        use: 'sig',
        alg: 'RS256',
        iat: now,
      },
    ];

    // Add all valid fallback keys
    for (const fallbackKey of this.fallbackKeys) {
      keysArray.push({
        ...fallbackKey.jwk,
        kid: fallbackKey.kid,
        use: 'sig',
        alg: 'RS256',
        iat: Math.floor(fallbackKey.rotatedAt.getTime() / 1000),
      });
    }

    return { keys: keysArray };
  }

  /**
   * Archive the current active key as a fallback key when rotating
   * Called before generating a new key
   */
  archiveCurrentKeyAsFallback(): void {
    const key = crypto.createPublicKey({
      key: this.publicKey,
      format: 'pem',
    });

    const jwk = key.export({ format: 'jwk' });
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.FALLBACK_KEY_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    this.fallbackKeys.push({
      kid: this.currentKeyId,
      publicKeyPem: this.publicKey,
      jwk,
      rotatedAt: now,
      expiresAt,
    });

    this.logger.log(
      `Archived key ${this.currentKeyId} as fallback until ${expiresAt.toISOString()}`,
    );
  }

  /**
   * Remove fallback keys that have expired
   */
  private cleanupExpiredFallbackKeys(): void {
    const now = new Date();
    const originalCount = this.fallbackKeys.length;

    this.fallbackKeys = this.fallbackKeys.filter((key) => key.expiresAt > now);

    if (this.fallbackKeys.length < originalCount) {
      this.logger.log(
        `Cleaned up ${originalCount - this.fallbackKeys.length} expired fallback keys`,
      );
    }
  }

  /**
   * Get fallback key by kid for verification
   * Used when verifying JWTs signed with an older key
   */
  getFallbackKey(kid: string): FallbackKey | undefined {
    this.cleanupExpiredFallbackKeys();
    return this.fallbackKeys.find((key) => key.kid === kid);
  }

  /**
   * List all active keys (active + fallback)
   * Useful for debugging and monitoring
   */
  listActiveKeys(): Array<{
    kid: string;
    type: 'active' | 'fallback';
    expiresAt?: string;
  }> {
    this.cleanupExpiredFallbackKeys();
    return [
      { kid: this.currentKeyId, type: 'active' },
      ...this.fallbackKeys.map((key) => ({
        kid: key.kid,
        type: 'fallback' as const,
        expiresAt: key.expiresAt.toISOString(),
      })),
    ];
  }

  decodeToken(token: string): JWTPayload {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      this.logger.error('Failed to decode JWT', error);
      throw error;
    }
  }
}
