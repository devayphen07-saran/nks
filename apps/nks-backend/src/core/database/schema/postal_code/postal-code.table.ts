import {
  pgTable,
  varchar,
  bigint,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { administrativeDivision } from '../administrative-division';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';
import { users } from '../users';
import { baseEntity, auditFields } from '../base.entity';

export const postalCode = pgTable(
  'postal_code',
  {
    ...baseEntity(),

    // No column-level .unique() — the same postal code can exist in multiple countries (e.g. "10001" in US and PH).
    code: varchar('code', { length: 20 }).notNull(),
    cityName: varchar('city_name', { length: 150 }).notNull(),

    administrativeDivisionFk: bigint('administrative_division_fk', {
      mode: 'number',
    })
      .notNull()
      .references(() => administrativeDivision.id, { onDelete: 'restrict' }),
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
    uniqueIndex('postal_code_code_country_idx')
      .on(table.code, table.countryFk)
      .where(sql`deleted_at IS NULL`),

    index('postal_code_city_name_idx').on(table.cityName),
    index('postal_code_admin_div_idx').on(table.administrativeDivisionFk),
    index('postal_code_state_idx').on(table.stateRegionProvinceFk),
  ],
);

export type PostalCode = typeof postalCode.$inferSelect;
export type NewPostalCode = typeof postalCode.$inferInsert;
export type UpdatePostalCode = Partial<Omit<NewPostalCode, 'id'>>;
