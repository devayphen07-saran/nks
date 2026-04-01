import { relations } from 'drizzle-orm';
import { postalCode } from './postal-code.table';
import { administrativeDivision } from '../administrative-division';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';

export const postalCodeRelations = relations(postalCode, ({ one }) => ({
  administrativeDivision: one(administrativeDivision, {
    fields: [postalCode.administrativeDivisionFk],
    references: [administrativeDivision.id],
  }),
  state: one(stateRegionProvince, {
    fields: [postalCode.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
  country: one(country, {
    fields: [postalCode.countryFk],
    references: [country.id],
  }),
}));
