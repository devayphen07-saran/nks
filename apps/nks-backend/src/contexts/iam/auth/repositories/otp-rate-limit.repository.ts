import { Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
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

  /** Generic patch — replaces 7 specialized setters. */
  async update(id: number, patch: Partial<OtpRequestLog>): Promise<void> {
    await this.db
      .update(schema.otpRequestLog)
      .set(patch)
      .where(eq(schema.otpRequestLog.id, id));
  }

  /** Atomic counter increment (race-safe). */
  async incrementCounter(
    id: number,
    field: 'requestCount' | 'consecutiveFailures',
  ): Promise<void> {
    const col = schema.otpRequestLog[field];
    await this.db
      .update(schema.otpRequestLog)
      .set({ [field]: sql`${col} + 1` })
      .where(eq(schema.otpRequestLog.id, id));
  }
}
