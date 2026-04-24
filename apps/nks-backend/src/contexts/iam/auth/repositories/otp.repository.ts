import { Injectable } from '@nestjs/common';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { OtpVerification, NewOtpVerification } from '../../../../core/database/schema/auth/otp-verification';

type OtpPurpose = 'LOGIN' | 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'RESET_PASSWORD';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async findByIdentifierAndPurpose(
    identifier: string,
    purpose: OtpPurpose,
  ): Promise<OtpVerification | null> {
    const [otp] = await this.db
      .select()
      .from(schema.otpVerification)
      .where(
        and(
          eq(schema.otpVerification.identifier, identifier),
          eq(schema.otpVerification.purpose, purpose),
        ),
      )
      .orderBy(desc(schema.otpVerification.createdAt))
      .limit(1);

    return otp ?? null;
  }

  async findById(id: number): Promise<OtpVerification | null> {
    const [otp] = await this.db
      .select()
      .from(schema.otpVerification)
      .where(eq(schema.otpVerification.id, id))
      .limit(1);

    return otp ?? null;
  }

  async create(data: NewOtpVerification): Promise<OtpVerification | null> {
    const [otp] = await this.db
      .insert(schema.otpVerification)
      .values(data)
      .returning();

    return otp ?? null;
  }

  async markAsUsed(otpId: number): Promise<void> {
    await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(eq(schema.otpVerification.id, otpId));
  }

  async incrementAttempts(otpId: number): Promise<void> {
    await this.db
      .update(schema.otpVerification)
      .set({
        attempts: sql`${schema.otpVerification.attempts} + 1`,
      })
      .where(eq(schema.otpVerification.id, otpId));
  }

  async deleteExpired(before: Date = new Date()): Promise<number> {
    const deleted = await this.db
      .delete(schema.otpVerification)
      .where(lt(schema.otpVerification.expiresAt, before))
      .returning({ id: schema.otpVerification.id });

    return deleted.length;
  }

  async delete(otpId: number): Promise<void> {
    await this.db
      .delete(schema.otpVerification)
      .where(eq(schema.otpVerification.id, otpId));
  }

  async markAsUsedByIdentifierAndPurpose(
    identifier: string,
    purpose: 'LOGIN' | 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'RESET_PASSWORD',
  ): Promise<void> {
    await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(
        and(
          eq(schema.otpVerification.identifier, identifier),
          eq(schema.otpVerification.isUsed, false),
          eq(schema.otpVerification.purpose, purpose),
        ),
      );
  }

  async insertOtpRecord(
    identifier: string,
    purpose: 'LOGIN' | 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'RESET_PASSWORD',
    value: string,
    expiresAt: Date,
    reqId?: string,
  ): Promise<void> {
    await this.db.insert(schema.otpVerification).values({
      identifier,
      value,
      purpose,
      expiresAt,
      ...(reqId && { reqId }),
    });
  }

  async findByIdentifierPurposeAndReqId(
    identifier: string,
    purpose: 'LOGIN' | 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'RESET_PASSWORD',
    reqId: string,
  ): Promise<OtpVerification | null> {
    const [otp] = await this.db
      .select()
      .from(schema.otpVerification)
      .where(
        and(
          eq(schema.otpVerification.identifier, identifier),
          eq(schema.otpVerification.purpose, purpose),
          eq(schema.otpVerification.reqId, reqId),
        ),
      )
      .orderBy(desc(schema.otpVerification.createdAt))
      .limit(1);

    return otp ?? null;
  }

  async findByReqId(reqId: string): Promise<OtpVerification | null> {
    const [otp] = await this.db
      .select()
      .from(schema.otpVerification)
      .where(eq(schema.otpVerification.reqId, reqId))
      .orderBy(desc(schema.otpVerification.createdAt))
      .limit(1);
    return otp ?? null;
  }

  async markAsUsedByReqId(reqId: string): Promise<void> {
    await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(
        and(
          eq(schema.otpVerification.reqId, reqId),
          eq(schema.otpVerification.isUsed, false),
        ),
      );
  }
}
