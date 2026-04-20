import type { Db } from './types.js';
import { entity } from '../../src/core/database/schema/index.js';
import data from './data/entities.js';

export async function seedEntities(db: Db) {
  return db.insert(entity).values(data).onConflictDoNothing();
}
