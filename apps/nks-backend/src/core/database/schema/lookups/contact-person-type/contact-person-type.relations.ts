import { relations } from 'drizzle-orm';
import { contactPersonType } from './contact-person-type.table';
import { contactPerson } from '../../communication/contact-person/contact-person.table';

export const contactPersonTypeRelations = relations(
  contactPersonType,
  ({ many }) => ({
    contacts: many(contactPerson),
  }),
);
