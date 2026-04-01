import { relations } from 'drizzle-orm';
import { contactPerson } from './contact-person.table';
import { entity } from '../entity';
import { contactPersonType } from '../contact-person-type';
import { salutation } from '../salutation';
import { users } from '../users';

export const contactPersonRelations = relations(contactPerson, ({ one }) => ({
  entity: one(entity, {
    fields: [contactPerson.entityFk],
    references: [entity.id],
  }),
  contactPersonType: one(contactPersonType, {
    fields: [contactPerson.contactPersonTypeFk],
    references: [contactPersonType.id],
  }),
  salutation: one(salutation, {
    fields: [contactPerson.salutationFk],
    references: [salutation.id],
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
