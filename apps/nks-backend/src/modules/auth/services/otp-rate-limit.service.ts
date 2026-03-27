import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../../core/database/schema';
import { eq } from 'drizzle-orm';

type Db = NodePgDatabase<typeof schema>;

/**
 * OTP Request Rate Limiting Service
 * Prevents DoS attacks by limiting OTP send requests per identifier (phone/email)
 *
 * Rules:
 * - Max 5 OTP requests per identifier per 24h window
 * - Window resets after 24 hours of inactivity
 */
@Injectable()
export class OtpRateLimitService {
  private readonly MAX_REQUESTS = 5;
  private readonly WINDOW_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Check if identifier can request OTP.
   * If limit exceeded, throws TooManyRequestsException.
   * If allowed, increments the request counter.
   */
  async checkAndRecordRequest(identifier: string): Promise<void> {
    const now = new Date();

    // Find existing rate limit record
    const [existing] = await this.db
      .select()
      .from(schema.otpRequestLog)
      .where(eq(schema.otpRequestLog.identifier, identifier))
      .limit(1);

    if (!existing) {
      // First request — create new record
      await this.db.insert(schema.otpRequestLog).values({
        identifier,
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
      await this.db
        .update(schema.otpRequestLog)
        .set({ requestCount: existing.requestCount + 1 })
        .where(eq(schema.otpRequestLog.id, existing.id));

      return;
    }

    // Window expired — reset
    await this.db
      .update(schema.otpRequestLog)
      .set({
        requestCount: 1,
        windowExpiresAt: new Date(now.getTime() + this.WINDOW_DURATION_MS),
      })
      .where(eq(schema.otpRequestLog.id, existing.id));
  }

  /**
   * Reset request count for identifier (useful after successful verification).
   */
  async resetRequestCount(identifier: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(schema.otpRequestLog)
      .where(eq(schema.otpRequestLog.identifier, identifier));

    if (existing) {
      await this.db
        .update(schema.otpRequestLog)
        .set({
          requestCount: 0,
          windowExpiresAt: new Date(Date.now() + this.WINDOW_DURATION_MS),
        })
        .where(eq(schema.otpRequestLog.id, existing.id));
    }
  }
}
