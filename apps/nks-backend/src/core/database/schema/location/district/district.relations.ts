import { relations } from 'drizzle-orm';
import { district } from './district.table';
import { state } from '../../location/state/state.table';
import { pincode } from '../../location/pincode/pincode.table';

export const districtRelations = relations(district, ({ one, many }) => ({
  state: one(state, {
    fields: [district.stateFk],
    references: [state.id],
  }),
  pincodes: many(pincode),
}));
