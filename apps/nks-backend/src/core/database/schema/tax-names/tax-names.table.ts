import { pgTable, varchar, bigint, index } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { taxAgencies } from '../tax-agencies';

/**
 * TAX_NAMES
 *
 * Represents a specific type of tax registered under a TaxAgency.
 * Multiple tax names can exist under the same agency (e.g., GSTN has CGST, SGST, IGST).
 *
 * Examples:
 *   - GST   → Goods and Services Tax (India)
 *   - CGST  → Central GST
 *   - SGST  → State GST
 *   - IGST  → Integrated GST
 *   - VAT   → Value Added Tax (UK/EU)
 */
export const taxNames = pgTable(
  'tax_names',
  {
    ...baseEntity(),

    // Short unique code — e.g. 'GST', 'CGST', 'SGST', 'IGST', 'VAT'
    code: varchar('code', { length: 50 }).notNull().unique(),

    // Human-readable label, e.g. "Goods and Services Tax"
    taxName: varchar('tax_name', { length: 255 }).notNull(),

    // Parent agency
    taxAgencyFk: bigint('tax_agency_fk', { mode: 'number' })
      .notNull()
      .references(() => taxAgencies.id, { onDelete: 'restrict' }),

    // Optional description
    description: varchar('description', { length: 1000 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('tax_names_code_idx').on(table.code),
    index('tax_names_agency_idx').on(table.taxAgencyFk),
  ],
);

export type TaxName = typeof taxNames.$inferSelect;
export type NewTaxName = typeof taxNames.$inferInsert;
export type UpdateTaxName = Partial<Omit<NewTaxName, 'id'>>;
