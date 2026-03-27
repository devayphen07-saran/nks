import { relations } from 'drizzle-orm';
import { district } from './district.table';
import { stateRegionProvince } from '../state-region-province';
import { pincode } from '../pincode';

export const districtRelations = relations(district, ({ one, many }) => ({
  state: one(stateRegionProvince, {
    fields: [district.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
  pincodes: many(pincode),
}));
