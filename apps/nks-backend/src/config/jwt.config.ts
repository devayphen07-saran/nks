import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { RSAKeyManager } from '../core/crypto/rsa-keys';

export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  primaryRole: string | null;
  stores: Array<{ id: number; name: string }>;
  activeStoreId: number | null;
  permissionsVersion?: string;
  permissionsSnapshot?: Record<string, Record<string, boolean>>;
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
  private currentKeyId = '2026-key-1';
  private fallbackKeys: FallbackKey[] = [];
  private readonly FALLBACK_KEY_DURATION_DAYS = 7;

  constructor() {
    try {
      this.privateKey = RSAKeyManager.getPrivateKey();
      this.publicKey = RSAKeyManager.getPublicKey();
      this.logger.debug('✅ RSA keys loaded');
    } catch (error) {
      this.logger.error('Failed to load RSA keys', error);
      throw error;
    }
  }

  /**
   * Sign JWT with RS256 (backend only)
   * Works for both WEB and MOBILE
   */
  signToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'kid'>): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 60; // 1 hour

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

  /**
   * Get JWKS (for mobile to download)
   * Returns active key + fallback keys from past 7 days
   * WEB: Optional, MOBILE: Required (for offline JWT verification)
   *
   * Key Rotation Strategy:
   * 1. Active key: Used for new token signatures
   * 2. Fallback keys: Kept for 7 days to allow graceful rotation
   * 3. Cache: 1 hour (max-age=3600) for fast emergency rotation propagation
   * 4. If key is compromised: Generate new key, add to JWKS, remove old after 7 days
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
