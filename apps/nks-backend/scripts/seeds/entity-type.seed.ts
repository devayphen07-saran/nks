import type { Db } from './types.js';
import { entityType } from '../../src/core/database/schema/lookups/entity-type/index.js';
import data from './data/entity-types.js';

export async function seedEntityTypes(db: Db) {
  return db.insert(entityType).values(data).onConflictDoNothing();
}
