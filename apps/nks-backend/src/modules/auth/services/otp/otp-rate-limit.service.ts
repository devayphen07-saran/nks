import { Injectable } from '@nestjs/common';
import { TooManyRequestsException } from '../../../../common/exceptions/too-many-requests.exception';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { OtpRateLimitRepository } from '../../repositories/otp-rate-limit.repository';

/**
 * OTP Request Rate Limiting Service
 * Prevents DoS attacks and cost overruns by limiting OTP send requests per identifier
 *
 * Rules:
 * - Max 5 OTP requests per identifier per 1-hour window
 * - Exponential backoff after failures: 30s → 1m → 2m → 5m → 15m → locked
 * - Window resets after 1 hour of inactivity
 * - Identifiers are hashed before storage (GDPR/DPDP compliance)
 *
 * Backoff Schedule (based on consecutive failures):
 * - 0-1 failures: No backoff
 * - 2 failures: 30 seconds
 * - 3 failures: 60 seconds
 * - 4 failures: 2 minutes
 * - 5 failures: 5 minutes
 * - 6+ failures: 15 minutes (locked)
 */
@Injectable()
export class OtpRateLimitService {
  private readonly MAX_REQUESTS_PER_HOUR = 5; // Reduced from 100/24h
  private readonly WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour

  // Exponential backoff delays (in milliseconds)
  private readonly BACKOFF_DELAYS = [
    0, // 0 failures: no delay
    0, // 1 failure: no delay
    30 * 1000, // 2 failures: 30 seconds
    60 * 1000, // 3 failures: 1 minute
    2 * 60 * 1000, // 4 failures: 2 minutes
    5 * 60 * 1000, // 5 failures: 5 minutes
    15 * 60 * 1000, // 6+ failures: 15 minutes (locked)
  ];

  constructor(
    private readonly otpRateLimitRepository: OtpRateLimitRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hash identifier (phone/email) for storage (GDPR/DPDP compliance).
   * Uses SHA256 with server-side pepper.
   */
  private hashIdentifier(identifier: string): string {
    const pepper = this.configService.getOrThrow<string>('OTP_IDENTIFIER_PEPPER');
    return crypto
      .createHash('sha256')
      .update(identifier + pepper)
      .digest('hex');
  }

  /**
   * Check if identifier can request OTP.
   * Enforces rate limit (5/hour) and exponential backoff.
   * Throws TooManyRequestsException(429) if rate limit or backoff applies.
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
        lastAttemptAt: now,
        consecutiveFailures: 0,
        windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
      });
      return;
    }

    // Check exponential backoff
    const backoffDelayMs = this.getBackoffDelay(existing.consecutiveFailures);
    if (existing.lastAttemptAt) {
      const timeSinceLastAttempt =
        now.getTime() - existing.lastAttemptAt.getTime();
      if (timeSinceLastAttempt < backoffDelayMs) {
        const secondsLeft = Math.ceil(
          (backoffDelayMs - timeSinceLastAttempt) / 1000,
        );
        throw new TooManyRequestsException({
          message: `Too many failed attempts. Try again in ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}.`,
          meta: { retryAfter: secondsLeft, failureCount: existing.consecutiveFailures },
        });
      }
    }

    // Window still active
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

      // Increment request counter and update last attempt time
      await this.otpRateLimitRepository.recordAttempt(
        existing.id,
        existing.requestCount + 1,
        now,
      );

      return;
    }

    // Window expired — reset counter and start fresh window
    await this.otpRateLimitRepository.resetWindow(
      existing.id,
      1, // New request count
      now,
      new Date(now.getTime() + this.WINDOW_DURATION_MS),
    );
  }

  /**
   * Get backoff delay in milliseconds based on consecutive failures.
   */
  private getBackoffDelay(consecutiveFailures: number): number {
    if (consecutiveFailures >= this.BACKOFF_DELAYS.length) {
      return this.BACKOFF_DELAYS[this.BACKOFF_DELAYS.length - 1];
    }
    return this.BACKOFF_DELAYS[consecutiveFailures] ?? 0;
  }

  /**
   * Reset request count and failure tracking for identifier (useful after successful verification).
   */
  async resetRequestCount(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(
      identifierHash,
    );

    if (existing) {
      await this.otpRateLimitRepository.resetFailureCount(existing.id);
      await this.otpRateLimitRepository.resetRequestCount(
        existing.id,
        new Date(Date.now() + this.WINDOW_DURATION_MS),
      );
    }
  }

  /**
   * Track failed OTP verification attempt.
   * Increments consecutive failures counter for exponential backoff.
   */
  async trackVerificationFailure(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(
      identifierHash,
    );

    if (existing) {
      const newFailureCount = (existing.consecutiveFailures ?? 0) + 1;
      await this.otpRateLimitRepository.incrementFailureCount(
        existing.id,
        newFailureCount,
      );
    }
  }
}
