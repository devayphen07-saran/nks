import { relations } from 'drizzle-orm';
import { administrativeDivision } from './administrative-division.table';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';
import { postalCode } from '../postal_code';
import { address } from '../address';

export const administrativeDivisionRelations = relations(
  administrativeDivision,
  ({ one, many }) => ({
    state: one(stateRegionProvince, {
      fields: [administrativeDivision.stateRegionProvinceFk],
      references: [stateRegionProvince.id],
    }),
    country: one(country, {
      fields: [administrativeDivision.countryFk],
      references: [country.id],
    }),
    postalCodes: many(postalCode),
    addresses: many(address),
  }),
);
