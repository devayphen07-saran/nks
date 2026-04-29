import { Injectable } from '@nestjs/common';
import { OtpValidator } from '../../validators';
import { SendOtpDto, VerifyOtpDto } from '../../dto/otp.dto';
import { VerifyEmailOtpDto } from '../../dto/email-verify.dto';
// NOTE: OtpService intentionally does NOT import AuthService
// This breaks the circular dependency. Session creation is now handled by OtpAuthOrchestrator.
import { OtpRepository } from '../../repositories/otp.repository';
import { AuthProviderRepository } from '../../repositories/auth-provider.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { OTP_MAX_ATTEMPTS } from '../../auth.constants';
import { TransactionService } from '../../../../../core/database/transaction.service';
import { OtpDeliveryService } from './otp-delivery.service';
import { Msg91Service } from '../providers/msg91.service';
import { OtpRateLimitService } from './otp-rate-limit.service';

/**
 * OtpService — Core OTP verification logic.
 *
 * This service is focused on OTP verification and user/email validation.
 * OTP delivery (SMS/email sending, rate limiting, hashing) is delegated to OtpDeliveryService.
 *
 * Dependencies (7):
 * - otpRepository: OTP record lookup
 * - authProviderRepository: Email provider management
 * - authUsersRepository: User lookup
 * - txService: Transactional operations
 * - otpDeliveryService: OTP delivery and hash verification
 * - msg91Service: SMS verification (OTP verification requires MSG91 access)
 * - rateLimitService: Track verification failures
 *
 * ARCHITECTURE: OtpService is pure OTP verification logic.
 * User find/create is handled by UserCreationService (injected via OtpAuthOrchestrator).
 * OtpAuthOrchestrator orchestrates: verify OTP → find/create user → create session.
 *
 * NOTE: msg91Service and rateLimitService are kept here (not in OtpDeliveryService)
 * because they are required for verification, not delivery. OtpDeliveryService handles
 * sending and rate limiting of send requests, while OtpService handles verification
 * and failure tracking.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly otpRepository: OtpRepository,
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly txService: TransactionService,
    private readonly otpDeliveryService: OtpDeliveryService,
    private readonly msg91: Msg91Service,
    private readonly rateLimitService: OtpRateLimitService,
  ) {}

  /**
   * Send OTP via SMS (MSG91).
   *
   * Delegates to OtpDeliveryService for SMS delivery, rate limiting, and OTP record storage.
   *
   * @param dto - Contains phone number
   * @throws HttpException(429 TOO_MANY_REQUESTS) if rate limit exceeded
   * @returns OTP send response with reqId and mobile number
   */
  async sendOtp(dto: SendOtpDto): Promise<{ reqId: string; mobile: string }> {
    const { phone } = dto;
    return this.otpDeliveryService.sendSmsOtp(phone);
  }

  /**
   * Verify OTP via MSG91 only — pure OTP verification logic.
   * Does NOT find/create user (Issue #16: Separated from OtpService).
   *
   * ARCHITECTURE: OtpService is pure OTP verification logic.
   * User find/create is handled by UserCreationService (injected via OtpAuthOrchestrator).
   * OtpAuthOrchestrator orchestrates: verify OTP → find/create user → create session.
   *
   * @returns Verification result (phone number, MSG91 response data)
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{
    verified: true;
    phone: string;
  }> {
    const { phone, otp, reqId } = dto;

    // All inputs already validated by ZodValidationPipe at controller level
    // 1. Verify reqId matches stored OTP record — prevents replay attacks
    const otpRecord = await this.otpRepository.findByIdentifierPurposeAndReqId(
      phone,
      'PHONE_VERIFY',
      reqId,
    );

    OtpValidator.assertOtpFound(otpRecord);
    OtpValidator.assertOtpNotUsed(otpRecord.isUsed);
    OtpValidator.assertOtpNotExpired(otpRecord.expiresAt);

    // 2. Verify with MSG91
    const response = await this.msg91.verifyOtp(reqId, otp);
    if (response?.type !== 'success') {
      // Track failed verification attempt for exponential backoff
      await this.rateLimitService.trackVerificationFailure(phone);
    }
    OtpValidator.assertMsg91VerifySuccess(response);

    // 3. CAS mark-as-used — closes the race window between assertOtpNotUsed (in-memory)
    // and this update. Two concurrent requests both pass the in-memory check; only the
    // one that wins the DB CAS proceeds. The loser gets OTP_ALREADY_USED.
    const marked = await this.otpRepository.markAsUsedByReqId(reqId);
    if (!marked) {
      OtpValidator.assertOtpNotUsed(true); // throws OTP_ALREADY_USED
    }

    // Return only verification result — user find/create handled by UserCreationService
    return {
      verified: true,
      phone,
    };
  }

  /**
   * Send OTP to email for verification (onboarding).
   *
   * Delegates to OtpDeliveryService for email delivery, rate limiting, OTP generation, hashing, and storage.
   *
   * @param email - Email address to send OTP to (must be present, validated by caller)
   * @throws HttpException(429 TOO_MANY_REQUESTS) if rate limit exceeded
   */
  async sendEmailOtp(email: string | null | undefined): Promise<void> {
    OtpValidator.assertEmailPresent(email);
    return this.otpDeliveryService.sendEmailOtp(email);
  }

  /**
   * Verify email OTP and link auth provider.
   * Called after user enters OTP during email verification in onboarding.
   */
  async verifyEmailOtp(dto: VerifyEmailOtpDto): Promise<void> {
    const { email, otp } = dto;

    // Find active OTP record
    const otpRecord = await this.otpRepository.findByIdentifierAndPurpose(
      email,
      'EMAIL_VERIFY',
    );

    OtpValidator.assertOtpFound(otpRecord);
    OtpValidator.assertOtpNotExpired(otpRecord.expiresAt);
    OtpValidator.assertAttemptsNotExceeded(
      otpRecord.attempts,
      OTP_MAX_ATTEMPTS,
    );

    // Claim the OTP atomically before verifying the value.
    // Two concurrent requests with the correct OTP both pass the in-memory checks
    // above; the DB CAS here ensures only one proceeds. The loser gets OTP_ALREADY_USED
    // without ever reaching the hash comparison, closing the TOCTOU window entirely.
    const marked = await this.otpRepository.markAsUsed(otpRecord.id);
    if (!marked) {
      OtpValidator.assertOtpNotUsed(true); // throws OTP_ALREADY_USED
    }

    // OTP is now claimed. Verify the value against the stored hash.
    // A wrong code here still consumes the OTP — the user must request a new one.
    // Verification is delegated to OtpDeliveryService which holds the HMAC secret.
    const isValid = this.otpDeliveryService.verifyOtpHash(otp, otpRecord.value);
    if (!isValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);
      OtpValidator.assertOtpValid(isValid);
    }

    // Steps 5-7: find user, upsert auth provider, mark email verified — all atomic.
    await this.txService.run(async (tx) => {
      // Find user by email (must exist from registration)
      const user = await this.authUsersRepository.findByEmail(email, tx);
      OtpValidator.assertUserFound(user);
      OtpValidator.assertNotBlocked(user);

      // Create or update email auth provider
      const existingProviderId =
        await this.authProviderRepository.findIdByUserIdAndProvider(
          user.id,
          'email',
          tx,
        );

      if (existingProviderId) {
        await this.authProviderRepository.updateVerification(
          existingProviderId,
          true,
          new Date(),
          tx,
        );
      } else {
        await this.authProviderRepository.create(
          {
            userId: user.id,
            providerId: 'email',
            accountId: email,
            isVerified: true,
            verifiedAt: new Date(),
          },
          tx,
        );
      }

      // Mark email as verified in users table
      await this.authUsersRepository.verifyEmail(user.id, tx);
    });

    // Reset rate limit counter (outside tx — non-critical, best-effort)
    await this.rateLimitService.resetRequestCount(email);
  }

  /**
   * Resend OTP using the original request ID from MSG91.
   *
   * Delegates to OtpDeliveryService for MSG91 resend, validation, and response formatting.
   *
   * @param reqId - Original request ID from MSG91
   * @returns OTP resend response with reqId and mobile
   */
  async resendOtp(reqId: string): Promise<{ reqId: string; mobile: string }> {
    return this.otpDeliveryService.resendSmsOtp(reqId);
  }
}
