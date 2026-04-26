import type { Db } from '../types.js';
import { designationType } from '../../../src/core/database/schema/lookups/designation-type/index.js';
import data from './data/designation-types.js';

export async function seedDesignationTypes(db: Db) {
  return db.insert(designationType).values(data).onConflictDoNothing();
}
