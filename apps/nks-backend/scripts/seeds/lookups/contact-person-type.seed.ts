import type { Db } from '../types.js';
import { contactPersonType } from '../../../src/core/database/schema/index.js';
import data from './data/contact-person-types.js';

export async function seedContactPersonTypes(db: Db) {
  return db.insert(contactPersonType).values(data).onConflictDoNothing();
}
