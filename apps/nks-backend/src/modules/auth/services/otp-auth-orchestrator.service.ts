import { Injectable, Logger } from '@nestjs/common';
import { OtpService } from './otp.service';
import { UserCreationService } from './user-creation.service';
import { AuthFlowOrchestrator } from './auth-flow-orchestrator.service';
import { VerifyOtpDto } from '../dto/otp.dto';
import type { AuthResponseEnvelope } from '../dto';

/**
 * OtpAuthOrchestrator - Orchestrates OTP verification, user creation, and session setup
 *
 * ARCHITECTURE (Issue #16: Separated OTP from User Creation):
 * - OtpService: Pure OTP verification only (verify token with MSG91)
 * - UserCreationService: User find/create logic (reusable for email signup, social auth)
 * - AuthFlowOrchestrator: Unified session + token + response creation
 * - OtpAuthOrchestrator: Bridges all three services
 *
 * This ensures:
 * - No circular dependencies
 * - Each service has single responsibility
 * - User creation logic is reusable across multiple auth flows
 *
 * Flow:
 *     OtpAuthOrchestrator
 *           │
 *     ┌─────┼─────┐
 *     │     │     │
 *   OTP  User  Auth
 *  Verify Create Flow
 */
@Injectable()
export class OtpAuthOrchestrator {
  constructor(
    private readonly otpService: OtpService,
    private readonly userCreationService: UserCreationService,
    private readonly authFlowOrchestrator: AuthFlowOrchestrator,
  ) {}

  /**
   * Orchestrate complete OTP verification → user creation → session creation → auth response flow
   *
   * Flow:
   * 1. Verify OTP via MSG91 (OtpService — pure verification)
   * 2. Find or create user by phone (UserCreationService — separated concern)
   * 3. Create session + tokens + build response (AuthFlowOrchestrator — unified auth flow)
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
    // Step 1: Verify OTP via MSG91 (pure verification, no user data)
    await this.otpService.verifyOtp(dto);

    // Step 2: Find or create user by phone (separate concern)
    const user = await this.userCreationService.findOrCreateByPhone(dto.phone);

    // Step 3: Unified auth flow (create session + tokens + build response)
    return this.authFlowOrchestrator.executeAuthFlow(user, deviceInfo);
  }
}
