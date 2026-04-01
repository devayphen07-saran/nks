import { relations } from 'drizzle-orm';
import { stateRegionProvince } from './state-region-province.table';
import { country } from '../country';
import { administrativeDivision } from '../administrative-division';

export const stateRegionProvinceRelations = relations(
  stateRegionProvince,
  ({ one, many }) => ({
    country: one(country, {
      fields: [stateRegionProvince.countryFk],
      references: [country.id],
    }),
    administrativeDivisions: many(administrativeDivision),
  }),
);
