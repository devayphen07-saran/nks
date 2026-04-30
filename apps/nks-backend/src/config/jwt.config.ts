import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { ConfigService } from '@nestjs/config';
import { RSAKeyManager } from '../core/crypto/rsa-keys';
import { InternalServerException } from '../common/exceptions';
import { ErrorCode, errPayload } from '../common/constants/error-codes.constants';

export interface JWTPayload {
  sub: string;
  sid: string;
  jti: string;
  /**
   * Cross-service user identifier. Treated as the primary external user ID — required,
   * never null, embedded as a URL path parameter in clients.
   */
  iamUserId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid?: string;
}

/** Offline JWT payload — identity + authorization + session binding */
export interface OfflineJWTPayload {
  sub: string;
  /** Session guuid — lets mobile detect revocation when coming online. */
  sid: string;
  jti: string;
  email?: string;
  roles: string[];
  stores: Array<{ guuid: string; name: string }>;
  activeStoreGuuid: string | null;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid?: string;
}

// ─── Zod schemas — validate jwt.verify() output before casting ───────────────

const JWTPayloadSchema = z.object({
  sub: z.string(),
  sid: z.string(),
  jti: z.string(),
  iamUserId: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  roles: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
  kid: z.string().optional(),
});

const OfflineJWTPayloadSchema = z.object({
  sub: z.string(),
  sid: z.string(),
  jti: z.string(),
  email: z.string().optional(),
  roles: z.array(z.string()),
  stores: z.array(z.object({ guuid: z.string(), name: z.string() })),
  activeStoreGuuid: z.string().nullable(),
  iat: z.number(),
  exp: z.number(),
  iss: z.string(),
  aud: z.string(),
  kid: z.string().optional(),
});

/**
 * Strict JWK (JSON Web Key) interface — only the fields defined by RFC 7517/7518 for RSA keys.
 * Replaces `Record<string, any>` to prevent arbitrary properties from passing through unnoticed.
 */
export interface JWK {
  kty: string; // Key type — always "RSA" for RS256
  n: string; // RSA modulus (base64url)
  e: string; // RSA exponent (base64url)
  kid?: string; // Key ID
  use?: string; // Key use — "sig" for signing
  alg?: string; // Algorithm — "RS256"
  iat?: number; // Issued-at (custom extension for JWKS rotation)
  pem?: string; // PEM-encoded public key — non-standard extension for mobile clients that
                // cannot reconstruct PEM from n/e without a native crypto API
}

export interface JWKSet {
  keys: JWK[];
}

/** Validate that an exported JsonWebKey has all required RSA fields and narrow to JWK. */
function toJWK(raw: crypto.JsonWebKey): JWK {
  const kty = typeof raw.kty === 'string' ? raw.kty : undefined;
  const n = typeof raw.n === 'string' ? raw.n : undefined;
  const e = typeof raw.e === 'string' ? raw.e : undefined;
  if (!kty || !n || !e) {
    throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
  }
  return {
    kty,
    n,
    e,
    kid: typeof raw.kid === 'string' ? raw.kid : undefined,
    use: typeof raw.use === 'string' ? raw.use : undefined,
    alg: typeof raw.alg === 'string' ? raw.alg : undefined,
  };
}

// Track fallback keys for graceful key rotation (30-day grace period)
interface FallbackKey {
  kid: string;
  publicKeyPem: string;
  jwk: JWK;
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
  private readonly FALLBACK_KEY_DURATION_DAYS = 30;
  private readonly fallbackKeysPath: string;

  constructor(private readonly configService: ConfigService) {
    const keysDir = this.configService.get<string>('JWT_KEYS_DIR') ?? path.join(process.cwd(), 'secrets');
    this.fallbackKeysPath = path.join(keysDir, 'jwt_fallback_keys.json');
    try {
      this.privateKey = RSAKeyManager.getPrivateKey();
      this.publicKey = RSAKeyManager.getPublicKey();
      this.logger.debug('✅ RSA keys loaded');

      // Compute kid as SHA-256 thumbprint of public key (RFC 7638)
      // This allows kid to automatically change on key rotation without hardcoding
      this.currentKeyId = this.computeKeyThumbprint(this.publicKey);
      this.logger.debug(
        `✅ Current key ID computed: ${this.currentKeyId.substring(0, 8)}...`,
      );

      // Load persisted fallback keys (survives restarts)
      this.fallbackKeys = this.loadFallbackKeysFromDisk();
      this.logger.debug(
        `✅ Loaded ${this.fallbackKeys.length} fallback key(s) from disk`,
      );
    } catch (error) {
      this.logger.error('Failed to load RSA keys', error);
      throw error;
    }
  }

  /** Load fallback keys from disk, filtering out expired ones. */
  private loadFallbackKeysFromDisk(): FallbackKey[] {
    try {
      if (!fs.existsSync(this.fallbackKeysPath)) return [];
      const raw = fs.readFileSync(this.fallbackKeysPath, 'utf8');
      const parsed: Array<{
        kid: string;
        publicKeyPem: string;
        jwk: JWK;
        rotatedAt: string;
        expiresAt: string;
      }> = JSON.parse(raw);
      const now = new Date();
      return parsed
        .map((k) => ({
          ...k,
          rotatedAt: new Date(k.rotatedAt),
          expiresAt: new Date(k.expiresAt),
        }))
        .filter((k) => k.expiresAt > now);
    } catch {
      this.logger.warn(
        'Could not read fallback keys from disk — starting fresh',
      );
      return [];
    }
  }

  /** Persist fallback keys to disk so they survive restarts. */
  private saveFallbackKeysToDisk(): void {
    try {
      const dir = path.dirname(this.fallbackKeysPath);
      if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(
        this.fallbackKeysPath,
        JSON.stringify(this.fallbackKeys, null, 2),
        { mode: 0o600 },
      );
    } catch (err) {
      this.logger.error('Failed to persist fallback keys to disk', err);
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
      sid: string;
      email?: string;
      roles: string[];
      stores: Array<{ guuid: string; name: string }>;
      activeStoreGuuid: string | null;
    },
    expiresIn: string = '3d',
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const seconds = this.parseExpiresIn(expiresIn);

    const tokenPayload: OfflineJWTPayload = {
      sub: payload.sub,
      sid: payload.sid,
      jti: crypto.randomUUID(),
      ...(payload.email ? { email: payload.email } : {}),
      roles: payload.roles,
      stores: payload.stores,
      activeStoreGuuid: payload.activeStoreGuuid,
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
    if (!match) {
      this.logger.error(`Invalid expiresIn format: ${value}`);
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }
    const num = parseInt(match[1], 10);
    switch (match[2]) {
      case 'd':
        return num * 86400;
      case 'h':
        return num * 3600;
      case 'm':
        return num * 60;
      default:
        return num;
    }
  }

  /**
   * Verify JWT with RS256 (backend + mobile offline).
   * On primary key failure, tries fallback keys by kid claim to support
   * graceful key rotation — tokens signed with the previous key remain
   * valid for up to 30 days after rotation.
   *
   * Fallback key expiration is checked explicitly to provide clear error messages
   * distinguishing "key rotation grace period expired" from "invalid signature".
   */
  verifyToken(token: string): JWTPayload {
    try {
      const raw = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'nks-auth',
        audience: 'nks-app',
      });
      return JWTPayloadSchema.parse(raw);
    } catch (primaryError) {
      // Decode without verification to read the kid claim and payload
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        this.logger.warn('JWT decode failed — malformed token');
        throw primaryError;
      }

      const kid = decoded.header?.kid as string | undefined;
      const payload = decoded.payload as any;

      if (kid && kid !== this.currentKeyId) {
        const fallback = this.getFallbackKey(kid);

        // Fallback key not found — check if it exists but has expired
        if (!fallback) {
          const expiredFallback = this.fallbackKeys.find(fk => fk.kid === kid);
          if (expiredFallback && expiredFallback.expiresAt <= new Date()) {
            const gracePeriodExpiredAt = expiredFallback.expiresAt.toISOString();
            this.logger.warn(
              `JWT signed with expired fallback key (kid=${kid}, expired=${gracePeriodExpiredAt})`,
            );
            throw new Error(
              `Token signed with key that rotated out on ${gracePeriodExpiredAt}. ` +
              `Please obtain a new token from the login endpoint.`,
            );
          }
        }

        // Fallback key exists and is still valid — try verification
        if (fallback) {
          try {
            const raw = jwt.verify(token, fallback.publicKeyPem, {
              algorithms: ['RS256'],
              issuer: 'nks-auth',
              audience: 'nks-app',
            });
            return JWTPayloadSchema.parse(raw);
          } catch (fallbackError) {
            this.logger.warn(
              `JWT verification failed with fallback key (kid=${kid})`,
              fallbackError,
            );
            // Fall through to throw primary error
          }
        }
      }

      this.logger.warn('JWT verification failed', primaryError);
      throw primaryError;
    }
  }

  /** Get the current key ID (for /nks-jwks endpoint) */
  getCurrentKid(): string {
    return this.currentKeyId;
  }

  /** Get the RSA public key in PEM format (for mobile JWKS endpoint) */
  getPublicKeyPem(): string {
    return this.publicKey;
  }

  /** Export the RSA public key in JWK format (for /nks-jwks endpoint) */
  getPublicKeyAsJwk(): JWK {
    const key = crypto.createPublicKey({ key: this.publicKey, format: 'pem' });
    return toJWK(key.export({ format: 'jwk' }));
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
  getPublicKeyAsJWKS(): JWKSet {
    // Clean up expired fallback keys
    this.cleanupExpiredFallbackKeys();

    const key = crypto.createPublicKey({
      key: this.publicKey,
      format: 'pem',
    });

    const activeJwk = toJWK(key.export({ format: 'jwk' }));
    const now = Math.floor(Date.now() / 1000);

    // Build keys array: active key first, then valid fallback keys
    const keysArray: JWK[] = [
      {
        ...activeJwk,
        kid: this.currentKeyId,
        use: 'sig',
        alg: 'RS256',
        iat: now,
        pem: this.publicKey,
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
        pem: fallbackKey.publicKeyPem,
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

    const jwk = toJWK(key.export({ format: 'jwk' }));
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

    // Persist to disk so the grace period survives server restarts
    this.saveFallbackKeysToDisk();

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

  /**
   * Verify an offline JWT (RS256) issued by signOfflineToken().
   *
   * Supports fallback keys so clients that received an offline token before
   * a key rotation can still push sync operations during the 30-day grace period.
   *
   * Throws JsonWebTokenError / TokenExpiredError (from jsonwebtoken) on failure —
   * callers should map these to ForbiddenException.
   *
   * @param token - The raw offline JWT string from the AuthResponse
   * @returns Verified and decoded OfflineJWTPayload
   */
  verifyOfflineToken(token: string): OfflineJWTPayload {
    try {
      const raw = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256'],
        issuer: 'nks-auth',
        audience: 'nks-app',
      });
      return OfflineJWTPayloadSchema.parse(raw);
    } catch (primaryError) {
      // Attempt verification with a fallback key if kid differs from current
      const decoded = jwt.decode(token, { complete: true });
      const kid = decoded?.header?.kid as string | undefined;

      if (kid && kid !== this.currentKeyId) {
        const fallback = this.getFallbackKey(kid);
        if (fallback) {
          try {
            const raw = jwt.verify(token, fallback.publicKeyPem, {
              algorithms: ['RS256'],
              issuer: 'nks-auth',
              audience: 'nks-app',
            });
            return OfflineJWTPayloadSchema.parse(raw);
          } catch (fallbackError) {
            this.logger.warn(
              `Offline JWT verification failed with fallback key (kid=${kid})`,
              fallbackError,
            );
          }
        }
      }

      this.logger.warn('Offline JWT verification failed', primaryError);
      throw primaryError;
    }
  }

  decodeToken(token: string): JWTPayload {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      this.logger.error('JWT decode returned null or raw string');
      throw new InternalServerException(errPayload(ErrorCode.INTERNAL_SERVER_ERROR));
    }
    return JWTPayloadSchema.parse(decoded);
  }
}
