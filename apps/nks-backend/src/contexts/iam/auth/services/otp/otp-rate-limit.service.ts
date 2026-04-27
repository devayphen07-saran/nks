import { Injectable } from '@nestjs/common';
import { TooManyRequestsException } from '../../../../../common/exceptions';
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
  private readonly MAX_REQUESTS_PER_HOUR = 5;
  private readonly WINDOW_DURATION_MS = 60 * 60 * 1000; // 1 hour
  private readonly ROW_TTL_MS = 24 * 60 * 60 * 1000; // 24h — hard-delete cleanup TTL

  // Exponential backoff delays (in milliseconds)
  private readonly BACKOFF_DELAYS = [
    0,             // 0 failures: no delay
    0,             // 1 failure:  no delay
    30 * 1000,     // 2 failures: 30 seconds
    60 * 1000,     // 3 failures: 1 minute
    2 * 60 * 1000, // 4 failures: 2 minutes
    5 * 60 * 1000, // 5 failures: 5 minutes
    15 * 60 * 1000,// 6+ failures: 15 minutes (locked)
  ];

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
        consecutiveFailures: 0,
        windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
        expiresAt: new Date(now.getTime() + this.ROW_TTL_MS),
      });
      return;
    }

    // Check exponential backoff
    const backoffDelayMs = this.getBackoffDelay(existing.consecutiveFailures);
    if (existing.lastAttemptAt) {
      const timeSinceLastAttempt = now.getTime() - existing.lastAttemptAt.getTime();
      if (timeSinceLastAttempt < backoffDelayMs) {
        const secondsLeft = Math.ceil((backoffDelayMs - timeSinceLastAttempt) / 1000);
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

      await this.otpRateLimitRepository.update(existing.id, {
        requestCount: existing.requestCount + 1,
        lastAttemptAt: now,
      });
      return;
    }

    // Window expired — reset counter and start fresh window
    await this.otpRateLimitRepository.update(existing.id, {
      requestCount: 1,
      lastAttemptAt: now,
      windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
      consecutiveFailures: 0,
      expiresAt: new Date(now.getTime() + this.ROW_TTL_MS),
    });
  }

  private getBackoffDelay(consecutiveFailures: number): number {
    if (consecutiveFailures >= this.BACKOFF_DELAYS.length) {
      return this.BACKOFF_DELAYS[this.BACKOFF_DELAYS.length - 1];
    }
    return this.BACKOFF_DELAYS[consecutiveFailures] ?? 0;
  }

  async resetRequestCount(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(identifierHash);
    if (existing) {
      await this.otpRateLimitRepository.update(existing.id, {
        consecutiveFailures: 0,
        requestCount: 0,
        windowExpiresAt: new Date(Date.now() + this.WINDOW_DURATION_MS),
      });
    }
  }

  async trackVerificationFailure(identifier: string): Promise<void> {
    const identifierHash = this.hashIdentifier(identifier);
    const existing = await this.otpRateLimitRepository.findByIdentifierHash(identifierHash);
    if (existing) {
      await this.otpRateLimitRepository.incrementCounter(existing.id, 'consecutiveFailures');
    }
  }
}
