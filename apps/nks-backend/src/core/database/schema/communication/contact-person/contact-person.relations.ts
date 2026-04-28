import { relations } from 'drizzle-orm';
import { contactPerson } from './contact-person.table';
import { entity } from '../../entity-system/entity';
import { lookup } from '../../lookups/lookup/lookup.table';
import { users } from '../../auth/users';

export const contactPersonRelations = relations(contactPerson, ({ one }) => ({
  entity: one(entity, {
    fields: [contactPerson.entityFk],
    references: [entity.id],
  }),
  contactPersonType: one(lookup, {
    fields: [contactPerson.contactPersonTypeFk],
    references: [lookup.id],
    relationName: 'contactPersonType',
  }),
  salutation: one(lookup, {
    fields: [contactPerson.salutationFk],
    references: [lookup.id],
    relationName: 'salutation',
  }),
  createdByUser: one(users, {
    fields: [contactPerson.createdBy],
    references: [users.id],
    relationName: 'createdByUser',
  }),
  modifiedByUser: one(users, {
    fields: [contactPerson.modifiedBy],
    references: [users.id],
    relationName: 'modifiedByUser',
  }),
  deletedByUser: one(users, {
    fields: [contactPerson.deletedBy],
    references: [users.id],
    relationName: 'deletedByUser',
  }),
}));
