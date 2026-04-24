import { Injectable } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { TokenService } from '../token/token.service';
import type { AuthResponseEnvelope } from '../../dto';
import type { DeviceInfo } from '../../interfaces/device-info.interface';

export interface AuthUserContext {
  id: number;
  guuid: string;
  /**
   * Required cross-service user identifier. Must be populated when loading
   * the user row (users.iam_user_id is NOT NULL in the schema).
   */
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  image: string | null | undefined;
  phoneNumber: string | null | undefined;
  phoneNumberVerified: boolean;
  defaultStoreFk?: number | null;
}

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
    user: AuthUserContext,
    deviceInfo?: DeviceInfo,
  ): Promise<AuthResponseEnvelope> {
    const session = await this.sessionService.createSessionForUser(user.id, deviceInfo);

    const tokenPair = await this.tokenService.createTokenPair(
      user.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
      session.jti,
      user.iamUserId,
      user.firstName,
      user.lastName,
    );

    return this.tokenService.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      session.sessionGuuid,
      tokenPair,
      session.permissions,
      deviceInfo?.deviceId,
    );
  }
}
