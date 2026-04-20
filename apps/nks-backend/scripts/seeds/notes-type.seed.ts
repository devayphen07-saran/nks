import type { Db } from './types.js';
import { notesType } from '../../src/core/database/schema/index.js';
import data from './data/notes-types.js';

export async function seedNotesTypes(db: Db) {
  return db.insert(notesType).values(data).onConflictDoNothing();
}
