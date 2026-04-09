import { relations } from 'drizzle-orm';
import { contactPerson } from './contact-person.table';
import { entity } from '../../entity-system/entity';
import { contactPersonType } from '../../lookups/contact-person-type';
import { codeValue } from '../../lookups/code-value/code-value.table';
import { users } from '../../auth/users';

export const contactPersonRelations = relations(contactPerson, ({ one }) => ({
  entity: one(entity, {
    fields: [contactPerson.entityFk],
    references: [entity.id],
  }),
  contactPersonType: one(contactPersonType, {
    fields: [contactPerson.contactPersonTypeFk],
    references: [contactPersonType.id],
  }),
  salutation: one(codeValue, {
    fields: [contactPerson.salutationFk],
    references: [codeValue.id],
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
