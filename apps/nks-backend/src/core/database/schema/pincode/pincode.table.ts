import {
  pgTable,
  varchar,
  bigint,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { district } from '../district';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';
import { users } from '../users';
import { baseEntity, auditFields } from '../base.entity';

export const pincode = pgTable(
  'pincode',
  {
    ...baseEntity(),

    // No column-level .unique() — the same postal code can exist in multiple countries (e.g. "10001" in US and PH).
    postalCode: varchar('postal_code', { length: 20 }).notNull(),
    cityName: varchar('city_name', { length: 150 }).notNull(),

    districtFk: bigint('district_fk', { mode: 'number' })
      .notNull()
      .references(() => district.id, { onDelete: 'restrict' }),
    stateRegionProvinceFk: bigint('state_region_province_fk', {
      mode: 'number',
    })
      .notNull()
      .references(() => stateRegionProvince.id, { onDelete: 'restrict' }),
    countryFk: bigint('country_fk', { mode: 'number' })
      .notNull()
      .references(() => country.id, { onDelete: 'restrict' }),

    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Postal codes are unique within a country, not globally.
    uniqueIndex('pincode_postal_code_country_idx')
      .on(table.postalCode, table.countryFk)
      .where(sql`deleted_at IS NULL`),

    index('pincode_city_name_idx').on(table.cityName),
    index('pincode_district_idx').on(table.districtFk),
    index('pincode_state_idx').on(table.stateRegionProvinceFk),
  ],
);

export type Pincode = typeof pincode.$inferSelect;
export type NewPincode = typeof pincode.$inferInsert;
export type UpdatePincode = Partial<Omit<NewPincode, 'id'>>;
