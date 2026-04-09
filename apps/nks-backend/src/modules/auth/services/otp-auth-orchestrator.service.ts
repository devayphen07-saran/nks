import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { VerifyOtpDto } from '../dto/otp.dto';
import type { AuthResponseEnvelope } from '../dto';

/**
 * OtpAuthOrchestrator - Breaks circular dependency between OtpService and AuthService
 *
 * ARCHITECTURE:
 * - OtpService: Pure OTP verification logic only. Returns {verified, userId, phone}
 * - AuthService: Never calls OtpService.verifyOtp() — only calls send methods (fine, not circular)
 * - OtpAuthOrchestrator: Bridges the two services, orchestrating the complete flow
 *
 * This ensures acyclic dependency graph:
 *   AuthService
 *     ↑
 *     └─── OtpAuthOrchestrator ───┐
 *                                    │
 *                                    ├──→ OtpService
 *                                    └──→ AuthService (for session/token creation)
 */
@Injectable()
export class OtpAuthOrchestrator {
  private readonly logger = new Logger(OtpAuthOrchestrator.name);

  constructor(
    private readonly otpService: OtpService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Orchestrate complete OTP verification → session creation → auth response flow
   *
   * Flow:
   * 1. Delegate to OtpService for OTP verification + user find/create (returns minimal result)
   * 2. Call AuthService to create session + build full auth response
   * 3. Return full AuthResponseEnvelope to caller
   *
   * @param dto - VerifyOtpDto { phone, otp, reqId }
   * @param deviceInfo - Device tracking info (optional)
   * @returns Full AuthResponseEnvelope with tokens and user data
   */
  async verifyOtpAndBuildAuthResponse(
    dto: VerifyOtpDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    // Step 1: Verify OTP + find/create user (OtpService returns minimal result)
    const verificationResult = await this.otpService.verifyOtp(dto);

    // Step 2: Create session for the verified user
    const session = await this.authService.createSessionForUser(
      verificationResult.userId,
      deviceInfo,
    );

    // Step 3: Create token pair (access + refresh tokens)
    const tokenPair = await this.authService.createTokenPair(
      verificationResult.guuid,
      session.token,
      session.userRoles,
      session.userEmail,
      session.sessionGuuid,
    );

    // Step 4: Build and return full auth response
    return this.authService.buildAuthResponse(
      verificationResult.user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }
}
