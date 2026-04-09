import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OtpRateLimitRepository } from '../repositories/otp-rate-limit.repository';

/**
 * OTP Request Rate Limiting Service
 * Prevents DoS attacks by limiting OTP send requests per identifier (phone/email)
 *
 * Rules:
 * - Max 100 OTP requests per identifier per 24h window
 * - Window resets after 24 hours of inactivity
 * - Identifiers are hashed before storage (GDPR/DPDP compliance)
 */
@Injectable()
export class OtpRateLimitService {
  private readonly MAX_REQUESTS = 100;
  private readonly WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly otpRateLimitRepository: OtpRateLimitRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hash identifier (phone/email) for storage (GDPR/DPDP compliance).
   * Uses SHA256 with server-side pepper.
   */
  private hashIdentifier(identifier: string): string {
    const pepper = this.configService.get<string>(
      'OTP_IDENTIFIER_PEPPER',
      'default-pepper',
    );
    return crypto
      .createHash('sha256')
      .update(identifier + pepper)
      .digest('hex');
  }

  /**
   * Check if identifier can request OTP.
   * If limit exceeded, throws TooManyRequestsException.
   * If allowed, increments the request counter.
   */
  async checkAndRecordRequest(identifier: string): Promise<void> {
    const now = new Date();
    const identifierHash = this.hashIdentifier(identifier);

    // Find existing rate limit record
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(
      identifierHash,
    );

    if (!existing) {
      // First request — create new record
      await this.otpRateLimitRepository.create({
        identifierHash,
        requestCount: 1,
        windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
      });
      return;
    }

    // Window still active
    if (existing.windowExpiresAt > now) {
      if (existing.requestCount >= this.MAX_REQUESTS) {
        const minutesLeft = Math.ceil(
          (existing.windowExpiresAt.getTime() - now.getTime()) / 60000,
        );
        throw new HttpException(
          `Too many OTP requests. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Increment counter
      await this.otpRateLimitRepository.incrementRequestCount(
        existing.id,
        existing.requestCount + 1,
      );

      return;
    }

    // Window expired — reset
    await this.otpRateLimitRepository.updateWindow(
      existing.id,
      new Date(now.getTime() + this.WINDOW_DURATION_MS),
    );
  }

  /**
   * Reset request count for identifier (useful after successful verification).
   */
  async resetRequestCount(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(
      identifierHash,
    );

    if (existing) {
      await this.otpRateLimitRepository.resetRequestCount(
        existing.id,
        new Date(Date.now() + this.WINDOW_DURATION_MS),
      );
    }
  }
}
