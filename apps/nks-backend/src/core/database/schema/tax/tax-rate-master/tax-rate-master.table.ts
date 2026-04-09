import {
  pgTable,
  numeric,
  bigint,
  timestamp,
  boolean,
  check,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { country } from '../../location/country';
import { commodityCodes } from '../../tax/commodity-codes';

/**
 * TAX_RATE_MASTER
 *
 * Single-Country, Store-Specific Tax Rate Configuration (India GST Only)
 *
 * Defines GST rates per store and commodity code (HSN — Harmonized System Nomenclature).
 * All rates are stored in India GST structure:
 *   - baseTaxRate: Combined GST rate (e.g., 18%)
 *   - component1Rate: CGST (Central GST, e.g., 9%)
 *   - component2Rate: SGST (State GST, e.g., 9%)
 *   - component3Rate: IGST (Integrated GST for inter-state)
 *   - additionalRate: Cess (additional levy, if any)
 *
 * All countryFk references point to India; taxAgencyFk would point to GSTN (implicit via country constraint).
 *
 * Supports rate changes with effective dates for compliance and legislative changes.
 */
export const taxRateMaster = pgTable(
  'tax_rate_master',
  {
    ...baseEntity(),

    // Country this tax rate applies to
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    // Store that this tax rate applies to
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),

    // Commodity code this rate applies to (HSN for India, HS/CN for other countries, etc.)
    commodityCodeFk: bigint('commodity_code_fk', { mode: 'number' })
      .notNull()
      .references(() => commodityCodes.id, { onDelete: 'restrict' }),

    // Total tax rate (e.g., 18.000 for India GST, 20.000 for UK VAT)
    baseTaxRate: numeric('base_tax_rate', {
      precision: 10,
      scale: 3,
    }).notNull(),

    // First tax component (e.g., CGST for India, NULL for single-rate countries)
    component1Rate: numeric('component1_rate', { precision: 10, scale: 3 }),

    // Second tax component (e.g., SGST for India, NULL for single-rate countries)
    component2Rate: numeric('component2_rate', { precision: 10, scale: 3 }),

    // Third tax component (e.g., IGST for inter-state India sales)
    component3Rate: numeric('component3_rate', { precision: 10, scale: 3 }),

    // Additional tax/cess (e.g., luxury items or tobacco cess in India)
    additionalRate: numeric('additional_rate', {
      precision: 10,
      scale: 3,
    }).default('0'),

    // Date this rate becomes effective
    effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull(), // ← FIXED: standardized to timestamp

    // Date this rate expires (NULL = still active)
    effectiveTo: timestamp('effective_to', { withTimezone: true }), // ← FIXED: standardized to timestamp

    // Is this rate currently in use?
    isActive: boolean('is_active').notNull().default(true),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Tax rate must be non-negative (supports 0% exempt rate through high rates)
    check('tax_rate_master_tax_rate_positive', sql`base_tax_rate >= 0`),

    // effectiveFrom must be before or equal to effectiveTo
    check(
      'tax_rate_master_date_range_chk',
      sql`effective_from <= effective_to OR effective_to IS NULL`,
    ),

    // Component rates, if set, must be non-negative
    check(
      'tax_rate_master_components_positive',
      sql`(component1_rate IS NULL OR component1_rate >= 0) AND (component2_rate IS NULL OR component2_rate >= 0) AND (component3_rate IS NULL OR component3_rate >= 0) AND additional_rate >= 0`,
    ),

    // base_tax_rate must equal the sum of its components to prevent dual source of truth.
    // COALESCE handles optional components (NULL treated as 0).
    check(
      'tax_rate_master_component_sum_chk',
      sql`base_tax_rate = COALESCE(component1_rate, 0) + COALESCE(component2_rate, 0) + COALESCE(component3_rate, 0) + COALESCE(additional_rate, 0)`,
    ),

    // Unique index for the current/latest rate per country + store + commodity code
    // Remember to set 'effective_to' on the OLD record before inserting a NEW one
    uniqueIndex('tax_rate_master_active_idx')
      .on(table.countryFk, table.storeFk, table.commodityCodeFk)
      .where(
        sql`is_active = true AND deleted_at IS NULL AND effective_to IS NULL`,
      ),

    index('tax_rate_master_country_idx').on(table.countryFk),
    index('tax_rate_master_store_idx').on(table.storeFk),
    index('tax_rate_master_commodity_idx').on(table.commodityCodeFk),
  ],
);

export type TaxRateMaster = typeof taxRateMaster.$inferSelect;
export type NewTaxRateMaster = typeof taxRateMaster.$inferInsert;
export type UpdateTaxRateMaster = Partial<Omit<NewTaxRateMaster, 'id'>>;
export type PublicTaxRateMaster = Omit<
  TaxRateMaster,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
