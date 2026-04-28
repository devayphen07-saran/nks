import { relations } from 'drizzle-orm';
import { address } from './address.table';
import { entity } from '../../entity-system/entity';
import { addressType } from '../../location/address-type/address-type.table';
import { state } from '../../location/state';
import { district } from '../../location/district';
import { pincode } from '../../location/pincode';
import { users } from '../../auth/users';

export const addressRelations = relations(address, ({ one }) => ({
  entity: one(entity, {
    fields: [address.entityFk],
    references: [entity.id],
  }),
  addressType: one(addressType, {
    fields: [address.addressTypeFk],
    references: [addressType.id],
  }),
  state: one(state, {
    fields: [address.stateFk],
    references: [state.id],
  }),
  district: one(district, {
    fields: [address.districtFk],
    references: [district.id],
  }),
  pincode: one(pincode, {
    fields: [address.pincodeFk],
    references: [pincode.id],
  }),
  createdByUser: one(users, {
    fields: [address.createdBy],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  modifiedByUser: one(users, {
    fields: [address.modifiedBy],
    references: [users.id],
    relationName: 'modifiedByUser',
  }),
  deletedByUser: one(users, {
    fields: [address.deletedBy],
    references: [users.id],
    relationName: 'deletedByUser',
  }),
}));
