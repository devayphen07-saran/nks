import { relations } from 'drizzle-orm';
import { salutation } from './salutation.table';
import { contactPerson } from '../contact-person';

// Salutation is a lookup table. It has no FK columns of its own —
// other tables reference it. We declare the inverse (many) side here.
export const salutationRelations = relations(salutation, ({ many }) => ({
  contactPersons: many(contactPerson),
}));
