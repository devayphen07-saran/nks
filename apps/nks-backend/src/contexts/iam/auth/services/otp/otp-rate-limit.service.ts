import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { TooManyRequestsException } from '../../../../../common/exceptions';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OtpRateLimitRepository } from '../../repositories/otp-rate-limit.repository';
import { OTP_MIN_VERIFY_INTERVAL_MS } from '../../auth.constants';

/**
 * OTP Request Rate Limiting Service.
 *
 * Caps OTP send requests per identifier to prevent DoS, vendor cost overruns,
 * and brute-force enumeration. The hard window cap is the sole control:
 *
 *   - Max 5 OTP requests per identifier per 1-hour rolling window
 *   - Window resets after 1 hour of inactivity
 *   - Identifiers SHA-256 + pepper hashed before storage (DPDP/GDPR)
 *
 * 5 requests/hour × 5 attempts each = 25 OTP guesses/hour, i.e. 0.0025% of the
 * 6-digit space. The previous exponential backoff curve on top of this added
 * complexity without meaningful additional security.
 */
@Injectable()
export class OtpRateLimitService {
  private readonly logger = new Logger(OtpRateLimitService.name);

  private readonly MAX_REQUESTS_PER_HOUR = 5;
  private readonly WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour
  private readonly ROW_TTL_MS = 24 * 60 * 60 * 1000; // 24h cleanup TTL

  constructor(
    private readonly otpRateLimitRepository: OtpRateLimitRepository,
    private readonly configService: ConfigService,
  ) {}

  private hashIdentifier(identifier: string): string {
    const pepper = this.configService.getOrThrow<string>('OTP_IDENTIFIER_PEPPER');
    return crypto
      .createHash('sha256')
      .update(identifier + pepper)
      .digest('hex');
  }

  async checkAndRecordRequest(identifier: string): Promise<void> {
    const now = new Date();
    const identifierHash = this.hashIdentifier(identifier);

    const existing = await this.otpRateLimitRepository.findByIdentifierHash(identifierHash);

    if (!existing) {
      await this.otpRateLimitRepository.create({
        identifierHash,
        requestCount: 1,
        lastAttemptAt: now,
        windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
        expiresAt: new Date(now.getTime() + this.ROW_TTL_MS),
      });
      return;
    }

    if (existing.windowExpiresAt > now) {
      if (existing.requestCount >= this.MAX_REQUESTS_PER_HOUR) {
        const minutesLeft = Math.ceil(
          (existing.windowExpiresAt.getTime() - now.getTime()) / 60000,
        );
        throw new TooManyRequestsException({
          message: `Rate limit exceeded (${this.MAX_REQUESTS_PER_HOUR} requests per hour). Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
          meta: { retryAfter: minutesLeft * 60 },
        });
      }

      await this.otpRateLimitRepository.update(existing.id, {
        requestCount: existing.requestCount + 1,
        lastAttemptAt: now,
      });
      return;
    }

    // Window expired — reset counter and start a fresh one.
    await this.otpRateLimitRepository.update(existing.id, {
      requestCount: 1,
      lastAttemptAt: now,
      windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
      expiresAt: new Date(now.getTime() + this.ROW_TTL_MS),
    });
  }

  async resetRequestCount(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(identifierHash);
    if (existing) {
      await this.otpRateLimitRepository.update(existing.id, {
        requestCount: 0,
        windowExpiresAt: new Date(Date.now() + this.WINDOW_DURATION_MS),
      });
    }
  }

  /**
   * Enforce a minimum gap between consecutive verify attempts on the same
   * identifier. Sleeps the response (rather than rejecting) when the gap is
   * shorter — costs automated attackers wall-clock time per attempt while
   * legitimate users (who type slower than 1.5s) never notice.
   *
   * Reuses lastAttemptAt; advances it to now so the next call sees the gap.
   */
  async enforceMinVerifyGap(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(identifierHash);
    const now = Date.now();

    if (existing?.lastAttemptAt) {
      const elapsed = now - existing.lastAttemptAt.getTime();
      if (elapsed < OTP_MIN_VERIFY_INTERVAL_MS) {
        await sleep(OTP_MIN_VERIFY_INTERVAL_MS - elapsed);
      }
    }

    if (existing) {
      await this.otpRateLimitRepository.update(existing.id, { lastAttemptAt: new Date() });
    }
  }
}
