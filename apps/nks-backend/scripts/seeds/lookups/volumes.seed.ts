import type { Db } from '../types.js';
import { volumes } from '../../../src/core/database/schema/index.js';
import data from './data/volumes.js';

export async function seedVolumes(db: Db) {
  return db.insert(volumes).values(data as (typeof volumes.$inferInsert)[]).onConflictDoNothing();
}
