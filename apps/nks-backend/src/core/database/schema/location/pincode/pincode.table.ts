import { pgTable, varchar, bigint, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from '../../auth/users';
import { baseEntity, auditFields } from '../../base.entity';
import { district } from '../../location/district/district.table';

/**
 * PINCODE
 *
 * India-Specific Location Table
 *
 * Simplified, India-focused alternative to postal_code.
 * Stores 6-digit Indian PIN codes (Postal Index Number) with locality and area information.
 *
 * Key differences from postal_code:
 * - code is always 6 digits (India PIN format)
 * - No countryFk (India-only)
 * - Replaces city_name with localityName + areaName
 * - Simpler FK structure: districtFk + stateFk (no multi-hierarchy support needed)
 *
 * No countryFk needed since this is India-only.
 */
export const pincode = pgTable(
  'pincode',
  {
    ...baseEntity(),

    // 6-digit Indian Postal Index Number
    code: varchar('code', { length: 6 }).notNull(),

    // Locality name (e.g., "Connaught Place" for Delhi 110001)
    localityName: varchar('locality_name', { length: 150 }).notNull(),

    // Area/neighborhood name (optional, e.g., "Central Delhi")
    areaName: varchar('area_name', { length: 150 }),

    // FK to district (no countryFk; both FKs are India-only)
    districtFk: bigint('district_fk', { mode: 'number' })
      .notNull()
      .references(() => district.id, { onDelete: 'restrict' }),

    // REMOVED: stateFk was denormalized (district already has state reference)
    // This prevented data inconsistency where district.stateFk ≠ pincode.stateFk
    // Derive state via district join if needed in queries

    // Geographic coordinates
    // Fixed precision: latitude ±90.0000000, longitude ±180.0000000
    latitude: numeric('latitude', { precision: 9, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // PIN code must be unique across all of India
    uniqueIndex('pincode_code_idx')
      .on(table.code)
      .where(sql`deleted_at IS NULL`),
    index('pincode_district_idx').on(table.districtFk),
    // REMOVED: pincode_state_idx (state now derived via district)
  ],
);

export type Pincode = typeof pincode.$inferSelect;
export type NewPincode = typeof pincode.$inferInsert;
export type UpdatePincode = Partial<Omit<NewPincode, 'id'>>;
export type PublicPincode = Omit<
  Pincode,
  'isActive' | 'deletedAt' | 'deletedBy' | 'createdBy' | 'modifiedBy'
>;
