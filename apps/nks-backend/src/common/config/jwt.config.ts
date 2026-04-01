import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { RSAKeyManager } from '../../core/crypto/rsa-keys';

export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  primaryRole: string | null;
  stores: Array<{ id: number; name: string }>;
  activeStoreId: number | null;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  kid?: string;
}

@Injectable()
export class JWTConfigService {
  private readonly logger = new Logger(JWTConfigService.name);
  private privateKey: string;
  private publicKey: string;
  private currentKeyId = '2026-key-1';

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
   * WEB: Optional, MOBILE: Required
   */
  getPublicKeyAsJWKS() {
    const key = crypto.createPublicKey({
      key: this.publicKey,
      format: 'pem',
    });

    const jwk = key.export({ format: 'jwk' });

    return {
      keys: [
        {
          ...jwk,
          kid: this.currentKeyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
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
