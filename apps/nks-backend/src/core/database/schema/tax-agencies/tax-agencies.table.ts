import { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { country } from '../country';

/**
 * TAX_AGENCIES
 *
 * Represents the governing body that administers a specific tax type.
 * This is the top-level entity in the tax hierarchy.
 *
 * Examples:
 *   - GSTN  → India Goods and Services Tax Network
 *   - HMRC  → UK His Majesty's Revenue and Customs
 *   - EU_OSS → EU One-Stop Shop VAT authority
 */
export const taxAgencies = pgTable(
  'tax_agencies',
  {
    ...baseEntity(),

    // Short unique code, e.g. 'GSTN', 'HMRC', 'EU_OSS'
    code: varchar('code', { length: 50 }).notNull().unique(),

    // Full display name
    name: varchar('name', { length: 255 }).notNull(),

    // Country this agency belongs to (nullable for international bodies like EU)
    countryFk: bigint('country_fk', { mode: 'number' }).references(
      () => country.id,
      { onDelete: 'set null' },
    ),

    // Description / notes
    description: varchar('description', { length: 1000 }),

    // Website or reference URL for this agency
    referenceUrl: varchar('reference_url', { length: 500 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('tax_agencies_code_idx').on(table.code),
    index('tax_agencies_country_idx').on(table.countryFk),
  ],
);

export type TaxAgency = typeof taxAgencies.$inferSelect;
export type NewTaxAgency = typeof taxAgencies.$inferInsert;
export type UpdateTaxAgency = Partial<Omit<NewTaxAgency, 'id'>>;
