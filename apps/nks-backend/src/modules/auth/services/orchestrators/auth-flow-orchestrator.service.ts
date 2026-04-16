import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { TokenService } from '../token/token.service';
import type { AuthResponseEnvelope } from '../../dto';

/**
 * AuthFlowOrchestrator
 *
 * Thin coordinator for the login / register / OTP authentication pipelines.
 * Delegates each step to the service that owns it:
 *
 *   1. SessionService.createSessionForUser  — BetterAuth + JWT + device fingerprint
 *   2. TokenService.createTokenPair         — RS256 access token + opaque refresh token
 *   3. TokenService.buildAuthResponse       — permissions, offline token, HMAC signature
 *
 * No business logic lives here — it only wires the three steps together.
 */
@Injectable()
export class AuthFlowOrchestrator {
  constructor(
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Unified auth flow: create session → generate tokens → build auth envelope.
   * Entry point for PasswordAuthService (login/register) and OtpAuthOrchestrator.
   */
  async executeAuthFlow(
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
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    const session = await this.sessionService.createSessionForUser(user.id, deviceInfo);

    const tokenPair = await this.tokenService.createTokenPair(
      user.guuid || '',
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    return this.tokenService.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
      session.permissions,
    );
  }
}
