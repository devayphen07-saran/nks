import {
  pgTable,
  varchar,
  numeric,
  boolean,
  bigint,
  index,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../base.entity';
import { users } from '../users';
import { country } from '../country';

// Commodity code classification type enum
// Supports multiple countries' classification systems
export const commodityCodeTypeEnum = pgEnum('commodity_code_type', [
  'HSN', // India: Harmonized System of Nomenclature (goods)
  'SAC', // India: Services Accounting Code
  'HS', // International: Harmonized System (for other countries)
  'CN', // EU: Combined Nomenclature
  'UNSPSC', // Universal: UN Standard Products and Services Code
]);

// Digit precision enum for HSN/HS codes
export const commodityDigitsEnum = pgEnum('commodity_digits', [
  '4',
  '6',
  '8',
  '10',
]);

/**
 * COMMODITY_CODES (Multi-Country Product Classification Master)
 *
 * Generic commodity/product/service classification system supporting multiple countries:
 * - India: HSN (goods 4/6/8 digits) + SAC (services)
 * - Other countries: HS codes, CN codes, or custom classification
 *
 * Each code is scoped to country and type, enabling:
 * - India stores: Use HSN/SAC codes with GST rates
 * - UK stores: Use HS/CN codes with VAT rates
 * - US stores: Use UNSPSC with sales tax categories
 *
 * Flexible structure supports different tax treatment per jurisdiction.
 */
export const commodityCodes = pgTable(
  'commodity_codes',
  {
    ...baseEntity(),

    // Country this commodity code applies to
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    // Classification system type (HSN for India, HS for international, CN for EU, etc.)
    type: commodityCodeTypeEnum('type').notNull(),

    // The actual commodity code (4-10 digits for HSN/HS, variable for others)
    code: varchar('code', { length: 10 }).notNull(),

    // For HSN/HS codes: store the digit count for easy filtering (4, 6, 8, or 10)
    // For other systems: may be null
    digits: commodityDigitsEnum('digits'),

    // Official technical description from classification authority
    // Examples: "Meat of bovine animals, fresh or chilled" (HSN 0201)
    description: varchar('description', { length: 1000 }).notNull(),

    // User-friendly name (e.g., "Beef" instead of full technical description)
    displayName: varchar('display_name', { length: 255 }),

    // Default tax rate for this code in its jurisdiction
    // Examples:
    //   India: GST rate (5, 12, 18, 28, etc.)
    //   UK: VAT rate (20, 5, 0, etc.)
    //   US: Sales tax category (varies by state)
    defaultTaxRate: numeric('default_tax_rate', { precision: 10, scale: 3 })
      .notNull()
      .default('0'),

    // For India: marks items like Fresh Milk or Books (exempt from GST)
    // For other countries: may indicate zero-rated or exempt status
    isExempted: boolean('is_exempted').notNull().default(false),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Commodity code must be unique per (country, type) to support same codes across systems
    // Example: Code "100" can exist as HSN in India and CN in EU
    uniqueIndex('commodity_codes_code_country_type_unique').on(
      table.code,
      table.countryFk,
      table.type,
    ),

    index('commodity_codes_type_code_idx').on(table.type, table.code),
    index('commodity_codes_digits_idx').on(table.digits),
    index('commodity_codes_country_idx').on(table.countryFk),
    index('commodity_codes_country_type_idx').on(table.countryFk, table.type),
  ],
);

export type CommodityCode = typeof commodityCodes.$inferSelect;
export type NewCommodityCode = typeof commodityCodes.$inferInsert;
export type UpdateCommodityCode = Partial<Omit<NewCommodityCode, 'id'>>;
export type PublicCommodityCode = Omit<
  CommodityCode,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
