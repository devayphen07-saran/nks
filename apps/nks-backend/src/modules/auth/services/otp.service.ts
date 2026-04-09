import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq, and } from 'drizzle-orm';
import {
  PhoneValidator,
  EmailValidator,
  OtpRequestValidator,
} from './validators';
import { SanitizerValidator } from '../../../common/validators/sanitizer.validator';

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
const OTP_HMAC_SECRET = process.env['OTP_HMAC_SECRET'] || 'default-otp-secret';
const OTP_MAX_ATTEMPTS = 5;
const OTP_EMAIL_DIGITS = 6;
import { Msg91Service } from './msg91.service';
import { SendOtpDto, VerifyOtpDto } from '../dto/otp.dto';
import { VerifyEmailOtpDto } from '../dto/email-verify.dto';
import { AuthService } from './auth.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpRepository } from '../repositories/otp.repository';
import { AuthProviderRepository } from '../repositories/auth-provider.repository';
import { AuthUsersRepository } from '../repositories/auth-users.repository';
import type { AuthResponseEnvelope } from '../dto';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDb() private readonly db: Db,
    private readonly msg91: Msg91Service,
    private readonly rateLimitService: OtpRateLimitService,
    private readonly authService: AuthService,
    private readonly otpRepository: OtpRepository,
    private readonly authProviderRepository: AuthProviderRepository,
    private readonly authUsersRepository: AuthUsersRepository,
  ) {}

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
    let { phone } = dto;

    // Sanitize phone number
    phone = SanitizerValidator.sanitizePhoneNumber(phone);

    // SECURITY: Validate phone format using PhoneValidator
    PhoneValidator.validate(phone);

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

    await this.otpRepository.insertOtpRecord(
      phone,
      'PHONE_VERIFY',
      'MSG91_MANAGED',
      10 * 60 * 1000,
    );

    // MSG91 returns reqId in the "message" field on success: { type: "success", message: "<reqId>" }
    // Normalize to { reqId } for consistent client consumption
    return { reqId: response.reqId ?? response.message, mobile: phone };
  }

  /**
   * Verify OTP via MSG91.
   * On success, identity is proven → AuthService creates session and returns auth response.
   *
   * @returns AuthResponseEnvelope with tokens and user data
   */
  async verifyOtp(
    dto: VerifyOtpDto,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      appVersion?: string;
    },
  ): Promise<AuthResponseEnvelope> {
    const { phone, otp, reqId } = dto;

    // Validate phone format
    OtpRequestValidator.validatePhone(phone);

    // Validate OTP code (6 digits)
    OtpRequestValidator.validateOtpCode(otp);

    // Validate request ID (UUID format)
    OtpRequestValidator.validateRequestId(reqId);

    // 1. Verify with MSG91
    const response = await this.msg91.verifyOtp(reqId, otp);
    if (response?.type !== 'success') {
      throw new BadRequestException(response?.message || 'Invalid OTP');
    }

    // 2. Mark OTP log as used
    await this.otpRepository.markAsUsedByIdentifierAndPurpose(
      phone,
      'PHONE_VERIFY',
    );

    // 3. Check if super admin has been seeded (first user case)
    await this.authService.isSuperAdminSeeded();

    // 4. Find or create user by phone (phone is now proven via MSG91)
    const user = await this.authService.findOrCreateUserByPhone(phone);

    // 5. Create session and get response envelope
    const session = await this.authService.createSessionForUser(
      user.id,
      deviceInfo,
    );

    // 6. Create token pair (access + refresh tokens)
    const tokenPair = await this.authService.createTokenPair(
      user.id,
      session.token,
      session.userRoles,
      session.userEmail,
    );

    // 7. Build and return full auth response
    return this.authService.buildAuthResponse(
      user,
      session.token,
      session.expiresAt,
      tokenPair,
    );
  }

  /**
   * Send OTP to email for verification (onboarding).
   */
  async sendEmailOtp(email: string): Promise<void> {
    // SECURITY: Validate email format using EmailValidator
    EmailValidator.validate(email);

    // Check rate limit
    await this.rateLimitService.checkAndRecordRequest(email);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash with HMAC-SHA256 before persisting — the plaintext OTP never touches the database
    const otpHash = this.hashOtp(otp);

    // Store hashed OTP record with EMAIL_VERIFY purpose
    await this.otpRepository.insertOtpRecord(
      email,
      'EMAIL_VERIFY',
      otpHash,
      24 * 60 * 60 * 1000,
    );

    // TODO: integrate email delivery service (SendGrid / AWS SES / SMTP)
    // The OTP is intentionally NOT logged — logging it would defeat hashing.
    this.logger.log(`Email OTP generated and stored (hashed) for: ${email}`);
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
      throw new BadRequestException('OTP expired or not found');
    }

    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Too many failed attempts. Request a new OTP.',
      );
    }

    // Compare provided OTP against the stored HMAC hash (timing-safe comparison)
    const isValid = this.verifyOtpHash(otp, otpRecord.value);
    if (!isValid) {
      await this.otpRepository.incrementAttempts(otpRecord.id);

      throw new BadRequestException('Invalid OTP');
    }

    // Mark OTP as used
    await this.otpRepository.markAsUsed(otpRecord.id);

    // Find user by email (must exist from registration)
    const user = await this.authUsersRepository.findByEmail(email);

    if (!user) {
      throw new BadRequestException('User not found');
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
      .createHmac('sha256', OTP_HMAC_SECRET)
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
