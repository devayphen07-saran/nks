import {
  pgTable,
  varchar,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';
import { users } from '../users';
import { baseEntity, auditFields } from '../base.entity';

/**
 * ADMINISTRATIVE DIVISION (Generic Multi-Country)
 *
 * Replaces India-specific district table with a generic structure supporting any country's
 * administrative subdivisions:
 * - India: District (within State)
 * - USA: County (within State)
 * - Germany: Landkreis (within State)
 * - France: Department (within Region)
 * - UK: County (no parent state)
 * - Canada: Municipality (within Province)
 *
 * The 'divisionType' field indicates what kind of division this is, allowing a single
 * table to represent any administrative structure across countries.
 */
export const administrativeDivision = pgTable(
  'administrative_division',
  {
    ...baseEntity(),

    // Name and code of the division
    divisionName: varchar('division_name', { length: 100 }).notNull(),
    divisionCode: varchar('division_code', { length: 20 }),

    // Type of administrative division (standardized across all countries)
    // Examples: DISTRICT, COUNTY, LANDKREIS, PREFECTURE, DEPARTMENT, MUNICIPALITY, BOROUGH
    divisionType: varchar('division_type', { length: 50 })
      .notNull()
      .default('DISTRICT'),
    description: varchar('description', { length: 255 }),

    // Hierarchical relationship: belongs to a State/Region/Province (optional)
    // Some countries have divisions directly under country (e.g., UK counties)
    stateRegionProvinceFk: bigint('state_region_province_fk', {
      mode: 'number',
    }).references(() => stateRegionProvince.id, { onDelete: 'restrict' }),

    // Country-level reference (required)
    // Ensures every division is geographically scoped
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Division names unique within their state (if state exists)
    uniqueIndex('admin_div_name_state_idx')
      .on(table.divisionName, table.stateRegionProvinceFk)
      .where(sql`state_region_province_fk IS NOT NULL AND deleted_at IS NULL`),

    // Division names unique within country (for state-less divisions)
    uniqueIndex('admin_div_name_country_idx')
      .on(table.divisionName, table.countryFk)
      .where(sql`state_region_province_fk IS NULL AND deleted_at IS NULL`),

    // Indexes for common queries
    index('admin_div_state_idx').on(table.stateRegionProvinceFk),
    index('admin_div_country_idx').on(table.countryFk),
    index('admin_div_type_idx').on(table.divisionType),
  ],
);

export type AdministrativeDivision = typeof administrativeDivision.$inferSelect;
export type NewAdministrativeDivision =
  typeof administrativeDivision.$inferInsert;
export type UpdateAdministrativeDivision = Partial<
  Omit<NewAdministrativeDivision, 'id'>
>;
export type PublicAdministrativeDivision = Omit<
  AdministrativeDivision,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
