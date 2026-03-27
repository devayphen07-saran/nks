import { relations } from 'drizzle-orm';
import { contactPerson } from './contact-person.table';
import { entity } from '../entity';

export const contactPersonRelations = relations(contactPerson, ({ one }) => ({
  entity: one(entity, {
    fields: [contactPerson.entityFk],
    references: [entity.id],
  }),
}));
