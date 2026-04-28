import {
  pgTable,
  varchar,
  bigint,
  date,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { country } from '../../location/country';
import { taxAgencies } from '../../tax/tax-agencies';
import { taxNames } from '../../tax/tax-names';
import { lookup } from '../../lookups/lookup/lookup.table';
import { taxFilingFrequency } from '../../tax/tax-filing-frequency/tax-filing-frequency.table';

/**
 * TAX_REGISTRATIONS
 *
 * A store's formal registration with a tax agency for a specific tax type.
 *
 * Single-Country Scope: India GST Only
 * Links the store's GSTIN (Goods and Services Tax Identification Number) to GSTN.
 * All registrations use countryFk = India and taxAgencyFk = GSTN.
 *
 * Constraint: One active GSTIN registration per store (enforced at application level).
 */
export const taxRegistrations = pgTable(
  'tax_registrations',
  {
    ...baseEntity(),

    // Store that holds this registration
    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'restrict' }),

    // Country where this tax applies
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    // The agency administering this tax (e.g. GSTN)
    taxAgencyFk: bigint('tax_agency_fk', { mode: 'number' })
      .notNull()
      .references(() => taxAgencies.id, { onDelete: 'restrict' }),

    // The type of tax registered (e.g. GST)
    taxNameFk: bigint('tax_name_fk', { mode: 'number' })
      .notNull()
      .references(() => taxNames.id, { onDelete: 'restrict' }),

    // The official registration number e.g. GSTIN, VAT Reg No
    registrationNumber: varchar('registration_number', {
      length: 100,
    }).notNull(),

    // State/Region/Province code (e.g., '29' for India Karnataka, 'CA' for US California, 'NSW' for Australia)
    // Required for intra/inter-state tax distinction in GST systems; optional for flat-rate systems (VAT)
    // Length supports: India 2-digit, US 2-letter, Australia 3-char, EU country codes, etc.
    regionCode: varchar('region_code', { length: 20 }),

    // Registration Type (Regular, Composition, Exempt, SEZ, Special)
    // NORMALIZED: Now an FK to tax_registration_type lookup table (was enum)
    registrationTypeFk: bigint('registration_type_fk', { mode: 'number' })
      .notNull()
      .references(() => lookup.id, { onDelete: 'restrict' }),

    // Display label e.g. "Main GST Registration"
    label: varchar('label', { length: 255 }),

    // How often the business must file returns (Monthly, Quarterly, Half-Yearly, Annual)
    // NORMALIZED: Now an FK to tax_filing_frequency lookup table (was enum)
    filingFrequencyFk: bigint('filing_frequency_fk', { mode: 'number' })
      .notNull()
      .references(() => taxFilingFrequency.id, { onDelete: 'restrict' }),

    // When this registration became effective
    effectiveFrom: date('effective_from').notNull(),

    // When this registration was cancelled (null = still active)
    effectiveTo: date('effective_to'),

    ...auditFields(() => users.id),
  },
  (table) => [
    // One active registration per store + agency + tax name
    uniqueIndex('tax_registrations_active_idx')
      .on(table.storeFk, table.taxAgencyFk, table.taxNameFk)
      .where(sql`deleted_at IS NULL AND effective_to IS NULL`),

    // Ensure date range is valid: effective_from <= effective_to OR effective_to IS NULL
    check(
      'tax_registrations_date_range_chk',
      sql`effective_from <= effective_to OR effective_to IS NULL`,
    ),

    // Unique registration number per country to avoid collisions across jurisdictions
    uniqueIndex('tax_registrations_number_country_idx').on(
      table.registrationNumber,
      table.countryFk,
    ),

    index('tax_registrations_store_idx').on(table.storeFk),
    index('tax_registrations_agency_idx').on(table.taxAgencyFk),
    index('tax_registrations_number_idx').on(table.registrationNumber),
    index('tax_registrations_country_idx').on(table.countryFk),
  ],
);

export type TaxRegistration = typeof taxRegistrations.$inferSelect;
export type NewTaxRegistration = typeof taxRegistrations.$inferInsert;
export type UpdateTaxRegistration = Partial<Omit<NewTaxRegistration, 'id'>>;
