import { relations } from 'drizzle-orm';
import { pincode } from './pincode.table';
import { district } from '../../location/district/district.table';
import { state } from '../../location/state/state.table';

export const pincodeRelations = relations(pincode, ({ one }) => ({
  district: one(district, {
    fields: [pincode.districtFk],
    references: [district.id],
  }),
  state: one(state, {
    fields: [pincode.stateFk],
    references: [state.id],
  }),
}));
