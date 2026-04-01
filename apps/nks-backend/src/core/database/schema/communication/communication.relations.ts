import { relations } from 'drizzle-orm';
import { communication } from './communication.table';
import { entity } from '../entity';
import { communicationType } from '../communication-type';
import { country } from '../country';
import { users } from '../users';

export const communicationRelations = relations(communication, ({ one }) => ({
  entity: one(entity, {
    fields: [communication.entityFk],
    references: [entity.id],
  }),
  communicationType: one(communicationType, {
    fields: [communication.communicationTypeFk],
    references: [communicationType.id],
  }),
  dialCountry: one(country, {
    fields: [communication.dialCountryFk],
    references: [country.id],
  }),
  createdByUser: one(users, {
    fields: [communication.createdBy],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  modifiedByUser: one(users, {
    fields: [communication.modifiedBy],
    references: [users.id],
    relationName: 'modifiedByUser',
  }),
  deletedByUser: one(users, {
    fields: [communication.deletedBy],
    references: [users.id],
    relationName: 'deletedByUser',
  }),
}));
