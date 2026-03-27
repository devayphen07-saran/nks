import { relations } from 'drizzle-orm';
import { stateRegionProvince } from './state-region-province.table';
import { country } from '../country';
import { district } from '../district';

export const stateRegionProvinceRelations = relations(
  stateRegionProvince,
  ({ one, many }) => ({
    country: one(country, {
      fields: [stateRegionProvince.countryFk],
      references: [country.id],
    }),
    districts: many(district),
  }),
);
