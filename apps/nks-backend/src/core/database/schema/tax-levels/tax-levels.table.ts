import {
  pgTable,
  varchar,
  numeric,
  bigint,
  boolean,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { taxNames } from '../tax-names';

/**
 * TAX_LEVELS
 *
 * Rate tiers within a specific tax name.
 * A TaxName can have multiple levels (e.g., GST → 0%, 5%, 12%, 18%, 28%, 3%, 0.25%).
 *
 * Examples under GST (India):
 *   - GST_0    → 0% (Nil Rated)
 *   - GST_5    → 5% (Essential goods)
 *   - GST_12   → 12% (Standard goods)
 *   - GST_18   → 18% (Standard services)
 *   - GST_28   → 28% (Luxury / sin goods)
 *   - GST_3    → 3% (Gold / jewelry)
 *   - GST_0_25 → 0.25% (Semi-precious stones)
 */
export const taxLevels = pgTable(
  'tax_levels',
  {
    ...baseEntity(),

    // Unique code — e.g. 'GST_18', 'GST_5', 'VAT_STANDARD', 'GST_3'
    code: varchar('code', { length: 50 }).notNull().unique(),

    // Human-readable name — e.g. "GST 18%" or "Reduced Rate VAT"
    name: varchar('name', { length: 255 }).notNull(),

    // The actual percentage rate — supports fractional rates like 0.25 or 3.0
    rate: numeric('rate', { precision: 10, scale: 3 }).notNull(),

    // Description / notes
    description: varchar('description', { length: 1000 }),

    // Parent tax name
    taxNameFk: bigint('tax_name_fk', { mode: 'number' })
      .notNull()
      .references(() => taxNames.id, { onDelete: 'restrict' }),

    // Is this the default level when none specified? (e.g. 18% for GST in India)
    isDefault: boolean('is_default').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    index('tax_levels_code_idx').on(table.code),
    index('tax_levels_tax_name_idx').on(table.taxNameFk),
    index('tax_levels_rate_idx').on(table.rate),

    // Ensure rate is non-negative and within reasonable bounds (0-100%)
    check('tax_levels_rate_range_chk', sql`rate >= 0 AND rate <= 100`),
  ],
);

export type TaxLevel = typeof taxLevels.$inferSelect;
export type NewTaxLevel = typeof taxLevels.$inferInsert;
export type UpdateTaxLevel = Partial<Omit<NewTaxLevel, 'id'>>;
