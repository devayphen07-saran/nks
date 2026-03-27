import { relations } from 'drizzle-orm';
import { pincode } from './pincode.table';
import { district } from '../district';
import { stateRegionProvince } from '../state-region-province';
import { country } from '../country';

export const pincodeRelations = relations(pincode, ({ one }) => ({
  district: one(district, {
    fields: [pincode.districtFk],
    references: [district.id],
  }),
  state: one(stateRegionProvince, {
    fields: [pincode.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
  country: one(country, {
    fields: [pincode.countryFk],
    references: [country.id],
  }),
}));
