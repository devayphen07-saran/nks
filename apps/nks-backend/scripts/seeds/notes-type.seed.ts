import type { Db } from './types.js';
import { notesType } from '../../src/core/database/schema';

const data = [
  { notesTypeName: 'General',  notesTypeCode: 'GENERAL',  sortOrder: 1, isSystem: true },
  { notesTypeName: 'Internal', notesTypeCode: 'INTERNAL', sortOrder: 2, isSystem: true },
  { notesTypeName: 'Feedback', notesTypeCode: 'FEEDBACK', sortOrder: 3, isSystem: true },
  { notesTypeName: 'Private',  notesTypeCode: 'PRIVATE',  sortOrder: 4, isSystem: true },
];

export async function seedNotesTypes(db: Db) {
  return db.insert(notesType).values(data).onConflictDoNothing();
}
