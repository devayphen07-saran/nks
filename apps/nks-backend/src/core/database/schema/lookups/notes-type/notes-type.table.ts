import { pgTable, varchar, text } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

export const notesType = pgTable('notes_type', {
  ...baseEntity(),

  notesTypeName: varchar('notes_type_name', { length: 50 }).notNull().unique(), // e.g. 'General', 'Feedback', 'Internal', 'Private'
  notesTypeCode: varchar('notes_type_code', { length: 30 }).notNull().unique(), // e.g. 'GENERAL', 'FEEDBACK', 'INTERNAL', 'PRIVATE'
  description: text('description'),

  ...auditFields(() => users.id),
});

export type NotesType = typeof notesType.$inferSelect;
export type NewNotesType = typeof notesType.$inferInsert;
export type UpdateNotesType = Partial<Omit<NewNotesType, 'id'>>;
