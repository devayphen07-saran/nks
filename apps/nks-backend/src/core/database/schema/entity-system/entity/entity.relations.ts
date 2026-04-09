import { relations } from 'drizzle-orm';
import { entity } from './entity.table';
import { address } from '../../location/address';
import { communication } from '../../communication/communication';
import { contactPerson } from '../../communication/contact-person';
import { notes } from '../../communication/notes';

export const entityRelations = relations(entity, ({ many }) => ({
  addresses: many(address),
  communications: many(communication),
  contactPersons: many(contactPerson),
  notes: many(notes),
}));
