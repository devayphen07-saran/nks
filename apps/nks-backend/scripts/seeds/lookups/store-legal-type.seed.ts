import type { Db } from '../types.js';
import { storeLegalType } from '../../../src/core/database/schema/lookups/store-legal-type/index.js';
import data from './data/store-legal-types.js';

export async function seedStoreLegalTypes(db: Db) {
  return db.insert(storeLegalType).values(data).onConflictDoNothing();
}
