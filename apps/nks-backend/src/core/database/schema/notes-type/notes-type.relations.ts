import { relations } from 'drizzle-orm';
import { notesType } from './notes-type.table';
import { notes } from '../notes';

export const notesTypeRelations = relations(notesType, ({ many }) => ({
  notes: many(notes),
}));
