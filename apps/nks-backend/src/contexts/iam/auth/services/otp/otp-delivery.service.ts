import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Msg91Service } from '../providers/msg91.service';
import { OtpRateLimitService } from './otp-rate-limit.service';
import { OtpRepository } from '../../repositories/otp.repository';
import { MailService } from '../../../../../shared/mail/mail.service';
import { OTP_EXPIRY_MS } from '../../auth.constants';
import { OtpValidator } from '../../validators';

/**
 * OtpDeliveryService — Responsible for delivering OTPs via SMS or email.
 *
 * This service extracts OTP delivery concerns from OtpService, handling:
 * - OTP generation (for email OTP only; SMS OTP is managed by MSG91)
 * - OTP hashing (HMAC-SHA256 for email OTP storage)
 * - Rate limiting enforcement
 * - Delivery via MSG91 (SMS) or MailService (email)
 * - OTP record persistence
 *
 * Dependencies (4):
 * - msg91Service: SMS delivery via MSG91
 * - rateLimitService: Rate limit enforcement
 * - otpRepository: OTP record persistence
 * - mailService: Email delivery
 * - configService: OTP_HMAC_SECRET for email OTP hashing
 *
 * HASHING STRATEGY: HMAC-SHA256 (not bcrypt)
 * - OTP has 10-minute expiry + 5-attempt rate limit
 * - bcrypt slowness (100-300ms) adds latency with zero security benefit
 * - HMAC-SHA256 is instant (<1ms) and designed for short-lived tokens (RFC 6238)
 */
@Injectable()
export class OtpDeliveryService {
  private readonly logger = new Logger(OtpDeliveryService.name);
  private readonly otpHmacSecret: string;

  constructor(
    private readonly msg91: Msg91Service,
    private readonly rateLimitService: OtpRateLimitService,
    private readonly otpRepository: OtpRepository,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.otpHmacSecret = this.configService.getOrThrow<string>('OTP_HMAC_SECRET');
  }

  /**
   * Send OTP via SMS (MSG91) and log the attempt for rate limiting.
   *
   * Rate Limit Rules:
   * - Max 100 OTP requests per phone number per 24-hour window
   * - If limit exceeded, throws HttpException(429) with retry-after time
   * - Window resets after 24 hours of inactivity
   *
   * @param phone - Phone number to send OTP to (validated by caller)
   * @throws HttpException(429 TOO_MANY_REQUESTS) if rate limit exceeded
   * @returns OTP send response from MSG91 (reqId, mobile)
   */
  async sendSmsOtp(phone: string): Promise<{ reqId: string; mobile: string }> {
    // Check rate limit — throws 429 if exceeded with retry-after message
    await this.rateLimitService.checkAndRecordRequest(phone);

    const response = await this.msg91.sendOtp(phone);

    // MSG91 returns { type: "error", message: "..." } on failure
    if (response?.type === 'error') {
      this.logger.warn(
        `MSG91 sendOtp rejected for ${phone}: ${response.message}`,
      );
    }
    OtpValidator.assertMsg91SendSuccess(response);

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
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
   * Send OTP to email for verification (onboarding).
   *
   * Generates a 6-digit OTP, hashes it with HMAC-SHA256, and delivers via MailService.
   * The plaintext OTP never touches the database.
   *
   * Rate Limit Rules:
   * - Max 100 OTP requests per email per 24-hour window
   * - If limit exceeded, throws HttpException(429) with retry-after time
   *
   * @param email - Email address to send OTP to (must be present, validated by caller)
   * @throws HttpException(429 TOO_MANY_REQUESTS) if rate limit exceeded
   */
  async sendEmailOtp(email: string): Promise<void> {
    // Check rate limit — throws 429 if exceeded with retry-after message
    await this.rateLimitService.checkAndRecordRequest(email);

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // Hash with HMAC-SHA256 before persisting — the plaintext OTP never touches the database
    const otpHash = this.hashOtp(otp);

    // Store hashed OTP record with EMAIL_VERIFY purpose
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
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
   * Resend OTP using the original request ID from MSG91.
   * Echoes `mobile` in the response (matches the shape of `sendSmsOtp`) so
   * clients don't need to stash it separately between send and resend.
   *
   * @param reqId - Original request ID from MSG91
   * @returns OTP resend response with reqId and mobile
   */
  async resendSmsOtp(reqId: string): Promise<{ reqId: string; mobile: string }> {
    const record = await this.otpRepository.findByReqId(reqId);
    OtpValidator.assertOtpFound(record);

    const response = await this.msg91.resendOtp(reqId);

    if (response?.type === 'error') {
      this.logger.warn(
        `MSG91 resendOtp rejected for reqId ${reqId}: ${response.message}`,
      );
    }
    OtpValidator.assertMsg91SendSuccess(response);

    // Normalize: MSG91 may return reqId in "message" field
    return {
      reqId: response.reqId ?? response.message,
      mobile: record.identifier,
    };
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
   * Used by OtpService for email OTP verification.
   *
   * @param otp - Plaintext OTP from user
   * @param storedHash - HMAC-SHA256 hash from database
   * @returns true if OTP matches hash
   */
  verifyOtpHash(otp: string, storedHash: string): boolean {
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
