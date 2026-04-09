import { Injectable, Logger } from '@nestjs/common';
import { JWTConfigService, JWTPayload } from '../../../config/jwt.config';

/**
 * TokenService
 * Wrapper around JWTConfigService for creating and verifying access tokens.
 * Refresh token lifecycle is managed separately by RefreshTokenService.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(private readonly jwtConfigService: JWTConfigService) {}

  /**
   * Create access token with user context
   * @param payload - JWT payload (without iat, exp, kid - added automatically)
   */
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

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return this.jwtConfigService.verifyToken(token);
    } catch (error) {
      this.logger.warn('Access token verification failed');
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging/logging only)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return this.jwtConfigService.decodeToken(token);
    } catch (error) {
      this.logger.warn('Failed to decode token');
      return null;
    }
  }
}
