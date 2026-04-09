import {
  pgTable,
  numeric,
  bigint,
  date,
  check,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { country } from '../../location/country';
import { store } from '../../store/store';

/**
 * DAILY_TAX_SUMMARY
 *
 * End-of-day tax aggregation per country, per store, grouped by tax rate.
 * Generated nightly to summarize tax collected during the day.
 * Multi-country ready: supports GST (India), VAT (UK/EU), Sales Tax (US), etc.
 *
 * Purpose:
 *   - Quick access to daily tax liability per tax slab/rate
 *   - Foundation for periodic tax reports (GSTR, VAT returns, etc.)
 *   - Audit trail for compliance
 *   - Dashboard reporting
 *
 * Example (India GST 18% intra-state):
 *   Store: 1, Date: 2024-03-27, taxRate: 18
 *   totalTaxable: 50,000 → totalCgst: 4,500 + totalSgst: 4,500 = totalTaxCollected: 9,000
 */
export const dailyTaxSummary = pgTable(
  'daily_tax_summary',
  {
    ...baseEntity(),

    // Country for this tax summary
    // ⚠️ RESTRICT (not cascade): daily_tax_summary is critical audit data.
    // Country references must never cascade delete.
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    // Store this summary belongs to
    // ⚠️ RESTRICT (not cascade): daily_tax_summary is critical audit data.
    // If a store must be deleted, the store record must be soft-deleted first,
    // and tax summaries remain for compliance/audit purposes.
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'restrict' }),

    // Date for which this summary is calculated
    transactionDate: date('transaction_date').notNull(),

    // Tax rate this row aggregates (e.g., 5, 12, 18, 28 for India GST; 20 for UK VAT; 0-10 for US Sales Tax)
    taxRate: numeric('tax_rate', { precision: 10, scale: 3 }).notNull(),

    // Sum of all item subtotals for this tax rate
    totalTaxableAmount: numeric('total_taxable_amount', {
      precision: 15,
      scale: 2,
    }).notNull(),

    // Central GST collected for this rate on this day
    totalCgstAmount: numeric('total_cgst_amount', { precision: 15, scale: 2 }).notNull().default('0'),

    // State GST collected for this rate on this day
    totalSgstAmount: numeric('total_sgst_amount', { precision: 15, scale: 2 }).notNull().default('0'),

    // Integrated GST collected (inter-state transactions)
    totalIgstAmount: numeric('total_igst_amount', { precision: 15, scale: 2 }).default('0'),

    // Cess collected (luxury/tobacco/clean-energy cess)
    totalCessAmount: numeric('total_cess_amount', { precision: 15, scale: 2 }).default('0'),

    // Total tax collected = cgst + sgst + igst + cess
    totalTaxCollected: numeric('total_tax_collected', {
      precision: 15,
      scale: 2,
    }).notNull(),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Tax rate must be non-negative (supports 0% exempt through any country rate)
    check('daily_tax_summary_tax_rate_positive_chk', sql`tax_rate >= 0`),

    // Tax collected must be sum of components (flexible for multi-country)
    check(
      'daily_tax_summary_tax_collected_chk',
      sql`total_tax_collected = total_cgst_amount + total_sgst_amount + COALESCE(total_igst_amount, 0) + COALESCE(total_cess_amount, 0)`,
    ),

    // No negative amounts
    check(
      'daily_tax_summary_amounts_positive_chk',
      sql`total_taxable_amount >= 0 AND total_cgst_amount >= 0 AND total_sgst_amount >= 0 AND total_tax_collected >= 0`,
    ),

    // One summary per country + store + date + tax rate combination
    uniqueIndex('daily_tax_summary_store_date_rate_unique').on(
      table.countryFk,
      table.storeFk,
      table.transactionDate,
      table.taxRate,
    ),

    // Query support: country lookups
    index('daily_tax_summary_country_idx').on(table.countryFk),

    // Most common query: all transactions for a store on a date range
    index('daily_tax_summary_store_date_idx').on(
      table.storeFk,
      table.transactionDate,
    ),

    // Date-range queries: transactions within a period
    index('daily_tax_summary_date_idx').on(table.transactionDate),

    // Tax rate aggregations and summaries
    index('daily_tax_summary_rate_idx').on(table.taxRate),
  ],
);

export type DailyTaxSummary = typeof dailyTaxSummary.$inferSelect;
export type NewDailyTaxSummary = typeof dailyTaxSummary.$inferInsert;
export type UpdateDailyTaxSummary = Partial<Omit<NewDailyTaxSummary, 'id'>>;
export type PublicDailyTaxSummary = Omit<
  DailyTaxSummary,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
