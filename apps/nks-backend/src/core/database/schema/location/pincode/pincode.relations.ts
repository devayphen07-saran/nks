import { relations } from 'drizzle-orm';
import { pincode } from './pincode.table';
import { district } from '../../location/district/district.table';

export const pincodeRelations = relations(pincode, ({ one }) => ({
  // Pincode has one district
  // State is derived via district (see district.relations.ts)
  district: one(district, {
    fields: [pincode.districtFk],
    references: [district.id],
  }),
}));
