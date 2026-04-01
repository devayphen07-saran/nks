import { relations } from 'drizzle-orm';
import { address } from './address.table';
import { entity } from '../entity';
import { addressType } from '../address-type';
import { stateRegionProvince } from '../state-region-province';
import { administrativeDivision } from '../administrative-division';
import { country } from '../country';
import { users } from '../users';

export const addressRelations = relations(address, ({ one }) => ({
  entity: one(entity, {
    fields: [address.entityFk],
    references: [entity.id],
  }),
  addressType: one(addressType, {
    fields: [address.addressTypeFk],
    references: [addressType.id],
  }),
  stateRegionProvince: one(stateRegionProvince, {
    fields: [address.stateRegionProvinceFk],
    references: [stateRegionProvince.id],
  }),
  administrativeDivision: one(administrativeDivision, {
    fields: [address.administrativeDivisionFk],
    references: [administrativeDivision.id],
  }),
  country: one(country, {
    fields: [address.countryFk],
    references: [country.id],
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
