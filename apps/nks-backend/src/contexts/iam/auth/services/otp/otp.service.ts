import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ErrorCode, errPayload } from '../../../../../common/constants/error-codes.constants';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Msg91Service } from '../providers/msg91.service';
import { SendOtpDto, VerifyOtpDto } from '../../dto/otp.dto';
import { VerifyEmailOtpDto } from '../../dto/email-verify.dto';
// NOTE: OtpService intentionally does NOT import AuthService
// This breaks the circular dependency. Session creation is now handled by OtpAuthOrchestrator.
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpRepository } from '../../repositories/otp.repository';
import { AuthProviderRepository } from '../../repositories/auth-provider.repository';
import { AuthUsersRepository } from '../../repositories/auth-users.repository';
import { MailService } from '../../../../../shared/mail/mail.service';

/**
 * OTP Hashing Strategy: HMAC-SHA256 (not bcrypt)
 *
 * Why not bcrypt?
 * - bcrypt is designed for passwords (intentionally slow: 100-300ms per operation)
 * - OTP has 10-minute expiry + 5-attempt rate limit
 * - Slowness adds latency with zero security benefit
 *
 * Why HMAC-SHA256?
 * - Instant verification (< 1ms)
 * - Designed for short-lived tokens
 * - Standard for TOTP/HOTP schemes (RFC 6238)
 */
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly otpHmacSecret: string;

  constructor(
    private readonly msg91: Msg91Service,
    private readonly rateLimitService: OtpRateLimitService,
    private readonly otpRepository: OtpRepository,
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly authUsersRepository: AuthUsersRepository,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    this.otpHmacSecret = this.configService.getOrThrow<string>('OTP_HMAC_SECRET');
  }

  /**
   * Send OTP via MSG91 and log the attempt for rate limiting.
   *
   * Rate Limit Rules:
   * - Max 100 OTP requests per phone number per 24-hour window
   * - If limit exceeded, throws HttpException(429) with retry-after time
   * - Window resets after 24 hours of inactivity
   *
   * @throws HttpException(429 TOO_MANY_REQUESTS) if rate limit exceeded
   * @returns OTP send response from MSG91
   */
  async sendOtp(dto: SendOtpDto) {
    const { phone } = dto;

    // Phone already validated by ZodValidationPipe at controller level
    // Check rate limit — throws 429 if exceeded with retry-after message
    await this.rateLimitService.checkAndRecordRequest(phone);

    const response = await this.msg91.sendOtp(phone);

    // MSG91 returns { type: "error", message: "..." } on failure
    if (response?.type === 'error') {
      this.logger.warn(
        `MSG91 sendOtp rejected for ${phone}: ${response.message}`,
      );
      throw new BadRequestException(response.message || 'Failed to send OTP');
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const reqId = response.reqId ?? response.message;

    // Store reqId in OTP record — required for verification to prevent replay
    await this.otpRepository.insertOtpRecord(
      phone,
      'PHONE_VERIFY',
      'MSG91_MANAGED',
      expiresAt,
      reqId,
    );

    return { reqId, mobile: phone };
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

    if (!otpRecord) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_NOT_FOUND));
    }

    if (otpRecord.isUsed) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_ALREADY_USED));
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_EXPIRED));
    }

    // 2. Verify with MSG91
    const response = await this.msg91.verifyOtp(reqId, otp);
    if (response?.type !== 'success') {
      // Track failed verification attempt for exponential backoff
      await this.rateLimitService.trackVerificationFailure(phone);
      throw new BadRequestException(response?.message || 'Invalid OTP');
    }

    // 3. Mark OTP log as used by reqId
    await this.otpRepository.markAsUsedByReqId(reqId);

    // Return only verification result — user find/create handled by UserCreationService
    return {
      verified: true,
      phone,
    };
  }

  /**
   * Send OTP to email for verification (onboarding).
   */
  async sendEmailOtp(email: string): Promise<void> {
    // Email already validated by ZodValidationPipe at controller level
    // Check rate limit
    await this.rateLimitService.checkAndRecordRequest(email);

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Hash with HMAC-SHA256 before persisting — the plaintext OTP never touches the database
    const otpHash = this.hashOtp(otp);

    // Store hashed OTP record with EMAIL_VERIFY purpose
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.otpRepository.insertOtpRecord(
      email,
      'EMAIL_VERIFY',
      otpHash,
      expiresAt,
    );

    // Deliver OTP via mail service (stub logs in dev; replace with real provider)
    await this.mailService.sendOtp(email, otp);
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

    if (!otpRecord) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_NOT_FOUND));
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_EXPIRED));
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(errPayload(ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED));
    }

    // Compare provided OTP against the stored HMAC hash (timing-safe comparison)
    const isValid = this.verifyOtpHash(otp, otpRecord.value);
    if (!isValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);

      throw new BadRequestException(errPayload(ErrorCode.OTP_INVALID));
    }

    // Mark OTP as used
    await this.otpRepository.markAsUsed(otpRecord.id);

    // Find user by email (must exist from registration)
    const user = await this.authUsersRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException(errPayload(ErrorCode.USER_NOT_FOUND));
    }

    // Create or update email auth provider
    const existingProviderId =
      await this.authProviderRepository.findIdByUserIdAndProvider(
        user.id,
        'email',
      );

    if (existingProviderId) {
      await this.authProviderRepository.updateVerification(
        existingProviderId,
        true,
        new Date(),
      );
    } else {
      await this.authProviderRepository.create({
        userId: user.id,
        providerId: 'email',
        accountId: email,
        isVerified: true,
        verifiedAt: new Date(),
      });
    }

    // Mark email as verified in users table
    await this.authUsersRepository.verifyEmail(user.id);

    // Reset rate limit counter
    await this.rateLimitService.resetRequestCount(email);
  }

  /**
   * Resend OTP using the original request ID from MSG91.
   */
  async resendOtp(reqId: string) {
    const response = await this.msg91.resendOtp(reqId);

    if (response?.type === 'error') {
      this.logger.warn(
        `MSG91 resendOtp rejected for reqId ${reqId}: ${response.message}`,
      );
      throw new BadRequestException(response.message || 'Failed to resend OTP');
    }

    // Normalize: MSG91 may return reqId in "message" field
    return { reqId: response.reqId ?? response.message };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  /**
   * Hash OTP for email verification using HMAC-SHA256.
   *
   * Why HMAC-SHA256 instead of bcrypt?
   * - OTP has 10-minute expiry + 5-attempt limit
   * - bcrypt slowness (100-300ms) adds latency with zero security benefit
   * - HMAC-SHA256 is instant (<1ms) and designed for short-lived tokens
   *
   * @param otp - 6-digit OTP code
   * @returns Hex-encoded HMAC-SHA256 hash
   */
  private hashOtp(otp: string): string {
    return crypto
      .createHmac('sha256', this.otpHmacSecret)
      .update(otp)
      .digest('hex');
  }

  /**
   * Verify OTP using timing-safe comparison.
   *
   * @param otp - Plaintext OTP from user
   * @param storedHash - HMAC-SHA256 hash from database
   * @returns true if OTP matches hash
   */
  private verifyOtpHash(otp: string, storedHash: string): boolean {
    const computed = this.hashOtp(otp);
    try {
      return crypto.timingSafeEqual(
        Buffer.from(storedHash),
        Buffer.from(computed),
      );
    } catch {
      // timingSafeEqual throws if lengths don't match
      return false;
    }
  }
}
