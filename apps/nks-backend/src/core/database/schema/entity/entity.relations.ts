import { relations } from 'drizzle-orm';
import { entity } from './entity.table';
import { address } from '../address';
import { communication } from '../communication';
import { contactPerson } from '../contact-person';
import { notes } from '../notes';

export const entityRelations = relations(entity, ({ many }) => ({
  addresses: many(address),
  communications: many(communication),
  contactPersons: many(contactPerson),
  notes: many(notes),
}));
