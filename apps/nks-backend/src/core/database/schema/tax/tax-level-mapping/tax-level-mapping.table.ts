import { pgTable, bigint, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../../base.entity';
import { taxAgencies } from '../../tax/tax-agencies';
import { taxLevels } from '../../tax/tax-levels';
import { taxNames } from '../../tax/tax-names';

/**
 * TAX_LEVEL_MAPPING
 *
 * Junction table linking TaxAgency → TaxName → TaxLevel.
 * Defines which rate levels are valid for a given agency + tax name combination.
 *
 * Example:
 *   GSTN + GST → [GST_0, GST_5, GST_12, GST_18, GST_28, GST_3, GST_0_25]
 *   HMRC + VAT → [VAT_STANDARD, VAT_REDUCED, VAT_ZERO]
 *
 * This enables flexible rate resolution:
 *   "For store with GSTN/GST, which rates are valid to assign to a product?"
 */
export const taxLevelMapping = pgTable(
  'tax_level_mapping',
  {
    ...junctionEntity(),

    taxAgencyFk: bigint('tax_agency_fk', { mode: 'number' })
      .notNull()
      .references(() => taxAgencies.id, { onDelete: 'cascade' }),

    taxNameFk: bigint('tax_name_fk', { mode: 'number' })
      .notNull()
      .references(() => taxNames.id, { onDelete: 'cascade' }),

    taxLevelFk: bigint('tax_level_fk', { mode: 'number' })
      .notNull()
      .references(() => taxLevels.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Each agency+name+level combination must be unique
    uniqueIndex('tax_level_mapping_unique_idx').on(
      table.taxAgencyFk,
      table.taxNameFk,
      table.taxLevelFk,
    ),
    index('tax_level_mapping_agency_name_idx').on(
      table.taxAgencyFk,
      table.taxNameFk,
    ),
  ],
);

export type TaxLevelMapping = typeof taxLevelMapping.$inferSelect;
export type NewTaxLevelMapping = typeof taxLevelMapping.$inferInsert;
