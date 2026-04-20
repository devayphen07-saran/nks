import type { Db } from './types.js';
import { salutationType } from '../../src/core/database/schema/lookups/salutation-type/index.js';
import data from './data/salutation-types.js';

export async function seedSalutationTypes(db: Db) {
  return db.insert(salutationType).values(data).onConflictDoNothing();
}
