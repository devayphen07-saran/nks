import {
  pgTable,
  bigint,
  numeric,
  varchar,
  date,
  check,
  index,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appendOnlyEntity } from '../../base.entity';
import { store } from '../../store/store';
import { country } from '../../location/country';
import { commodityCodes } from '../../tax/commodity-codes';
import { taxRateMaster } from '../../tax/tax-rate-master';
import { taxRegistrations } from '../../tax/tax-registrations';
import { users } from '../../auth/users';
import { taxLineStatus } from '../../tax/tax-line-status';

// Approval lifecycle for tax lines: PENDING (recorded) → APPROVED (validated) | REJECTED (disputed)
// Now managed via tax_line_status lookup table instead of enum for extensibility

/**
 * TRANSACTION_TAX_LINES
 *
 * Immutable, per-line tax breakdown for every sale/purchase transaction.
 * Multi-country tax compliance: supports GST (India), VAT (UK/EU), Sales Tax (US), etc.
 *
 * These are append-only records (never updated/deleted) to maintain
 * a permanent, tamper-proof audit trail of all tax collected.
 *
 * One row per transaction line item. India GST components named explicitly:
 *   Intra-state: cgstAmount + sgstAmount (IGST=0, UTGST=0)
 *   Inter-state:  igstAmount             (CGST=0, SGST=0, UTGST=0)
 *   UT supply:    cgstAmount + utgstAmount
 */
export const transactionTaxLines = pgTable(
  'transaction_tax_lines',
  {
    ...appendOnlyEntity(),

    // Country where the transaction occurred
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    // Store where the transaction occurred
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'restrict' }),

    // Tax registration that governs this transaction tax
    taxRegistrationFk: bigint('tax_registration_fk', { mode: 'number' })
      .notNull()
      .references(() => taxRegistrations.id, { onDelete: 'restrict' }),

    // The commodity code (HSN for India, HS/CN for other countries) of the product/service on this line
    commodityCodeFk: bigint('commodity_code_fk', { mode: 'number' })
      .notNull()
      .references(() => commodityCodes.id, { onDelete: 'restrict' }),

    // The rate record that was applied at time of transaction
    taxRateMasterFk: bigint('tax_rate_master_fk', {
      mode: 'number',
    }).references(() => taxRateMaster.id, { onDelete: 'restrict' }),

    // External reference to the transaction/sale (no FK enforced — flexible for future transaction table)
    transactionRef: bigint('transaction_ref', { mode: 'number' }).notNull(),

    // External reference to the specific line item within the transaction
    transactionItemRef: bigint('transaction_item_ref', { mode: 'number' }),

    // Date of the transaction — essential for GSTR period-wise reconciliation
    transactionDate: date('transaction_date').notNull(),

    // The amount before tax (base price × quantity − discount)
    taxableAmount: numeric('taxable_amount', {
      precision: 15,
      scale: 3,
    }).notNull(),

    // Central GST — intra-state transactions; 0 for inter-state/UT
    cgstAmount: numeric('cgst_amount', { precision: 15, scale: 3 }).notNull().default('0'),

    // State GST — intra-state transactions; 0 for inter-state/UT
    sgstAmount: numeric('sgst_amount', { precision: 15, scale: 3 }).notNull().default('0'),

    // Integrated GST — inter-state transactions; 0 for intra-state/UT
    igstAmount: numeric('igst_amount', { precision: 15, scale: 3 }).notNull().default('0'),

    // Union Territory GST — UT supply; 0 otherwise
    utgstAmount: numeric('utgst_amount', { precision: 15, scale: 3 }).notNull().default('0'),

    // Cess — luxury/tobacco/clean-energy cess; 0 when not applicable
    cessAmount: numeric('cess_amount', { precision: 15, scale: 3 }).notNull().default('0'),

    // Sum: cgst + sgst + igst + utgst + cess
    totalTaxAmount: numeric('total_tax_amount', {
      precision: 15,
      scale: 3,
    }).notNull(),

    // --- E-Invoicing Compliance ---
    // Invoice Reference Number (64-char hash, used for India e-invoicing)
    irn: varchar('irn', { length: 64 }),

    // QR Code URL or string for the signed JSON (used for India e-invoicing)
    qrCodeUrl: varchar('qr_code_url', { length: 2048 }),

    // Tax rate applied (snapshot at time of sale — rate may change later)
    appliedTaxRate: numeric('applied_tax_rate', {
      precision: 10,
      scale: 3,
    }).notNull(),

    // --- Audit Trail ---
    // User who recorded this transaction tax line
    createdBy: bigint('created_by', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    // Approval state machine: PENDING → APPROVED | REJECTED
    // FK to tax_line_status lookup table (PENDING, APPROVED, REJECTED)
    approvalStatusFk: bigint('approval_status_fk', { mode: 'number' })
      .notNull()
      .references(() => taxLineStatus.id, { onDelete: 'restrict' }),

    // User who approved/rejected this record
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Timestamp when this record was approved or rejected
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (table) => [
    // Tax collected must equal sum of components (flexible for multi-country)
    check(
      'transaction_tax_lines_total_tax_chk',
      sql`total_tax_amount = cgst_amount + sgst_amount + igst_amount + utgst_amount + cess_amount`,
    ),

    // All amounts must be non-negative
    check(
      'transaction_tax_lines_amounts_positive_chk',
      sql`taxable_amount >= 0 AND cgst_amount >= 0 AND sgst_amount >= 0 AND igst_amount >= 0 AND utgst_amount >= 0 AND cess_amount >= 0 AND total_tax_amount >= 0`,
    ),

    // Tax rate must be non-negative
    check(
      'transaction_tax_lines_rate_positive_chk',
      sql`applied_tax_rate >= 0`,
    ),

    // Query patterns: by country + store + date (GSTR filing), by transaction ref, by commodity code
    index('transaction_tax_lines_country_idx').on(table.countryFk),
    index('transaction_tax_lines_store_date_idx').on(
      table.storeFk,
      table.transactionDate,
    ),
    index('transaction_tax_lines_transaction_ref_idx').on(table.transactionRef),
    index('transaction_tax_lines_commodity_idx').on(table.commodityCodeFk),
    index('transaction_tax_lines_registration_idx').on(table.taxRegistrationFk),

    // Composite index for tax filing queries: country + store + commodity code + date range
    index('transaction_tax_lines_country_store_commodity_date_idx').on(
      table.countryFk,
      table.storeFk,
      table.commodityCodeFk,
      table.transactionDate,
    ),

    // Composite index for tax rate analysis: country + store + applied rate + date
    index('transaction_tax_lines_country_store_rate_date_idx').on(
      table.countryFk,
      table.storeFk,
      table.appliedTaxRate,
      table.transactionDate,
    ),
  ],
);

export type TransactionTaxLine = typeof transactionTaxLines.$inferSelect;
export type NewTransactionTaxLine = typeof transactionTaxLines.$inferInsert;
