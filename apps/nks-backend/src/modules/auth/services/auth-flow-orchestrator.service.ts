import { Injectable } from '@nestjs/common';
import type { AuthResponseEnvelope } from '../dto';
import { AuthService } from './auth.service';

/**
 * Auth Flow Orchestrator
 * Consolidates common session creation and token pair generation logic.
 *
 * Prevents duplication across multiple auth flows (OTP, Login, Register, etc).
 * Single source of truth for session + token lifecycle.
 */
@Injectable()
export class AuthFlowOrchestrator {
  constructor(private readonly authService: AuthService) {}

  /**
   * Unified auth flow: create session + generate tokens + build auth envelope.
   *
   * Called by:
   * - OTP login (otp-auth-orchestrator)
   * - Email/password login (auth.service.ts)
   * - Registration (auth.service.ts)
   *
   * @param user - User object with id, guuid, email, name, etc
   * @param deviceInfo - Device context (IP, user agent, device type, etc)
   * @returns Complete AuthResponseEnvelope ready for response
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
    // Step 1: Create session for the user
    const session = await this.authService.createSessionForUser(user.id, deviceInfo);

    // Step 2: Generate token pair (access token + refresh token)
    const tokenPair = await this.authService.createTokenPair(
      user.guuid || '',
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    // Step 3: Build complete auth envelope (user data + session + tokens)
    return this.authService.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }
}
