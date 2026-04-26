import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { OtpRequestLog, NewOtpRequestLog } from '../../../../core/database/schema/auth/otp-request-log';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpRateLimitRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async findByIdentifierHash(identifierHash: string): Promise<OtpRequestLog | null> {
    const [record] = await this.db
      .select()
      .from(schema.otpRequestLog)
      .where(eq(schema.otpRequestLog.identifierHash, identifierHash))
      .limit(1);

    return record ?? null;
  }

  async create(data: NewOtpRequestLog): Promise<OtpRequestLog | null> {
    const [record] = await this.db
      .insert(schema.otpRequestLog)
      .values(data)
      .returning();

    return record ?? null;
  }

  async incrementRequestCount(id: number, newCount: number): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({ requestCount: newCount })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async resetRequestCount(id: number, newWindowExpiresAt: Date): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({
        requestCount: 0,
        windowExpiresAt: newWindowExpiresAt,
      })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async updateWindow(id: number, newWindowExpiresAt: Date): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({
        requestCount: 1,
        windowExpiresAt: newWindowExpiresAt,
      })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async recordAttempt(
    id: number,
    newRequestCount: number,
    lastAttemptAt: Date,
  ): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({
        requestCount: newRequestCount,
        lastAttemptAt,
      })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async resetWindow(
    id: number,
    newRequestCount: number,
    lastAttemptAt: Date,
    newWindowExpiresAt: Date,
    newExpiresAt: Date,
  ): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({
        requestCount: newRequestCount,
        lastAttemptAt,
        windowExpiresAt: newWindowExpiresAt,
        consecutiveFailures: 0,
        expiresAt: newExpiresAt,
      })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async incrementFailureCount(id: number, newFailureCount: number): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({ consecutiveFailures: newFailureCount })
      .where(eq(schema.otpRequestLog.id, id));
  }

  async resetFailureCount(id: number): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set({ consecutiveFailures: 0 })
      .where(eq(schema.otpRequestLog.id, id));
  }
}
