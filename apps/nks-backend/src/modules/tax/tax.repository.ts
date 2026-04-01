import { Injectable } from '@nestjs/common';
import { eq, and, isNull, lte, or, gte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { InjectDb } from '../../core/database/inject-db.decorator';

type Tx = NodePgDatabase<typeof schema>;

@Injectable()
export class TaxRepository {
  constructor(@InjectDb() private readonly db: Tx) {}

  /**
   * Find tax agency by code
   */
  async findAgencyByCode(code: string) {
    const [result] = await this.db
      .select()
      .from(schema.taxAgencies)
      .where(eq(schema.taxAgencies.code, code))
      .limit(1);
    return result || null;
  }

  /**
   * Find all tax agencies for a country
   */
  async findAgenciesByCountry(countryId: number) {
    return this.db
      .select()
      .from(schema.taxAgencies)
      .where(eq(schema.taxAgencies.countryFk, countryId));
  }

  /**
   * Find tax name by code
   */
  async findTaxNameByCode(code: string) {
    const [result] = await this.db
      .select()
      .from(schema.taxNames)
      .where(eq(schema.taxNames.code, code))
      .limit(1);
    return result || null;
  }

  /**
   * Find all tax names for an agency
   */
  async findTaxNamesByAgency(agencyId: number) {
    return this.db
      .select()
      .from(schema.taxNames)
      .where(eq(schema.taxNames.taxAgencyFk, agencyId));
  }

  /**
   * Find commodity code by code, type, and country
   */
  async findCommodityCode(
    countryId: number,
    code: string,
    type: 'HSN' | 'SAC' | 'HS' | 'CN' | 'UNSPSC',
  ) {
    const [result] = await this.db
      .select()
      .from(schema.commodityCodes)
      .where(
        and(
          eq(schema.commodityCodes.countryFk, countryId),
          eq(schema.commodityCodes.code, code),
          eq(schema.commodityCodes.type, type),
        ),
      )
      .limit(1);
    return result || null;
  }

  /**
   * Find all commodity codes for a country
   */
  async findCommodityCodesByCountry(countryId: number) {
    return this.db
      .select()
      .from(schema.commodityCodes)
      .where(eq(schema.commodityCodes.countryFk, countryId));
  }

  /**
   * Find tax rate master for store and commodity code on a given date
   * Returns the most recent rate that is effective on the given date
   */
  async findApplicableTaxRate(
    storeId: number,
    commodityCodeId: number,
    transactionDate: string,
  ) {
    const [result] = await this.db
      .select()
      .from(schema.taxRateMaster)
      .where(
        and(
          eq(schema.taxRateMaster.storeFk, storeId),
          eq(schema.taxRateMaster.commodityCodeFk, commodityCodeId),
          lte(schema.taxRateMaster.effectiveFrom, transactionDate),
          or(
            isNull(schema.taxRateMaster.effectiveTo),
            gte(schema.taxRateMaster.effectiveTo, transactionDate),
          ),
          eq(schema.taxRateMaster.isActive, true),
        ),
      )
      .orderBy(schema.taxRateMaster.effectiveFrom)
      .limit(1);
    return result || null;
  }

  /**
   * Find all active tax rates for a store
   */
  async findTaxRatesByStore(storeId: number) {
    return this.db
      .select()
      .from(schema.taxRateMaster)
      .where(
        and(
          eq(schema.taxRateMaster.storeFk, storeId),
          eq(schema.taxRateMaster.isActive, true),
        ),
      );
  }

  /**
   * Find tax registration by registration number and country
   */
  async findTaxRegistrationByNumber(
    countryId: number,
    registrationNumber: string,
  ) {
    const [result] = await this.db
      .select()
      .from(schema.taxRegistrations)
      .where(
        and(
          eq(schema.taxRegistrations.countryFk, countryId),
          eq(schema.taxRegistrations.registrationNumber, registrationNumber),
          isNull(schema.taxRegistrations.deletedAt),
        ),
      )
      .limit(1);
    return result || null;
  }

  /**
   * Find all active tax registrations for a store
   */
  async findTaxRegistrationsByStore(storeId: number) {
    return this.db
      .select()
      .from(schema.taxRegistrations)
      .where(
        and(
          eq(schema.taxRegistrations.storeFk, storeId),
          isNull(schema.taxRegistrations.effectiveTo),
          isNull(schema.taxRegistrations.deletedAt),
        ),
      );
  }

  /**
   * Create a new tax registration
   */
  async createTaxRegistration(
    data: typeof schema.taxRegistrations.$inferInsert,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [inserted] = await client
      .insert(schema.taxRegistrations)
      .values(data)
      .returning();
    return inserted;
  }

  /**
   * Update tax registration
   */
  async updateTaxRegistration(
    id: number,
    data: Partial<typeof schema.taxRegistrations.$inferInsert>,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [updated] = await client
      .update(schema.taxRegistrations)
      .set(data)
      .where(eq(schema.taxRegistrations.id, id))
      .returning();
    return updated;
  }

  /**
   * Find daily tax summary by store and date
   */
  async findDailyTaxSummary(
    storeId: number,
    countryId: number,
    transactionDate: string,
  ) {
    return this.db
      .select()
      .from(schema.dailyTaxSummary)
      .where(
        and(
          eq(schema.dailyTaxSummary.storeFk, storeId),
          eq(schema.dailyTaxSummary.countryFk, countryId),
          eq(schema.dailyTaxSummary.transactionDate, transactionDate),
        ),
      );
  }

  /**
   * Create or update daily tax summary
   */
  async upsertDailyTaxSummary(
    data: typeof schema.dailyTaxSummary.$inferInsert,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [result] = await client
      .insert(schema.dailyTaxSummary)
      .values(data)
      .onConflictDoUpdate({
        target: [
          schema.dailyTaxSummary.countryFk,
          schema.dailyTaxSummary.storeFk,
          schema.dailyTaxSummary.transactionDate,
          schema.dailyTaxSummary.taxRate,
        ],
        set: {
          totalTaxableAmount: data.totalTaxableAmount,
          totalComponent1Amount: data.totalComponent1Amount,
          totalComponent2Amount: data.totalComponent2Amount,
          totalComponent3Amount: data.totalComponent3Amount,
          totalAdditionalAmount: data.totalAdditionalAmount,
          totalTaxCollected: data.totalTaxCollected,
        },
      })
      .returning();
    return result;
  }

  /**
   * Find transaction tax lines by transaction reference
   */
  async findTransactionTaxLines(transactionRef: number) {
    return this.db
      .select()
      .from(schema.transactionTaxLines)
      .where(eq(schema.transactionTaxLines.transactionRef, transactionRef));
  }

  /**
   * Create transaction tax line
   */
  async createTransactionTaxLine(
    data: typeof schema.transactionTaxLines.$inferInsert,
    tx?: Tx,
  ) {
    const client = tx ?? this.db;
    const [inserted] = await client
      .insert(schema.transactionTaxLines)
      .values(data)
      .returning();
    return inserted;
  }
}
