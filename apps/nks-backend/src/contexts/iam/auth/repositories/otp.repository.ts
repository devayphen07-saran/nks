import { Injectable } from '@nestjs/common';
import { eq, and, lt, desc, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import { TransactionService } from '../../../../core/database/transaction.service';
import * as schema from '../../../../core/database/schema';
import type { OtpVerification, NewOtpVerification } from '../../../../core/database/schema/auth/otp-verification';
import { otpPurposeEnum } from '../../../../core/database/schema/enums';

type OtpPurpose = typeof otpPurposeEnum.enumValues[number];

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class OtpRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

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

  /**
   * CAS mark-as-used: only flips is_used when it is currently false.
   * Returns true if this call was the one that flipped it (the row was not
   * already used), false if a concurrent call beat it to the update.
   * Callers should treat false as a replay/race and reject the verification.
   */
  async markAsUsed(otpId: number): Promise<boolean> {
    const rows = await this.db
      .update(schema.otpVerification)
      .set({ isUsed: true })
      .where(
        and(
          eq(schema.otpVerification.id, otpId),
          eq(schema.otpVerification.isUsed, false),
        ),
      )
      .returning({ id: schema.otpVerification.id });
    return rows.length > 0;
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

  /**
   * Insert a new OTP record and supersede any prior active records for the
   * same identifier+purpose in one atomic transaction.
   *
   * Without this, sending OTP twice gives the attacker two independent attempt
   * budgets (5 each = 10 total) because findByIdentifierAndPurpose only returns
   * the latest record — the older one is still "live" and un-attempt-counted.
   * Superseding collapses the attempt budget to a single active record.
   */
  async insertOtpRecord(
    identifier: string,
    purpose: 'LOGIN' | 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'RESET_PASSWORD',
    value: string,
    expiresAt: Date,
    reqId?: string,
  ): Promise<void> {
    await this.txService.run(async (tx) => {
      // Supersede all previous active OTPs for this identifier+purpose so
      // only one valid record exists at any point in time.
      await tx
        .update(schema.otpVerification)
        .set({ isUsed: true })
        .where(
          and(
            eq(schema.otpVerification.identifier, identifier),
            eq(schema.otpVerification.purpose, purpose),
            eq(schema.otpVerification.isUsed, false),
          ),
        );

      await tx.insert(schema.otpVerification).values({
        identifier,
        value,
        purpose,
        expiresAt,
        ...(reqId && { reqId }),
      });
    }, { name: 'OtpRepository.insertOtpRecord' });
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
