import type { Db } from '../types.js';
import { state } from '../../../src/core/database/schema/index.js';
import data from './data/states.js';

export async function seedStateTable(db: Db) {
  const rows = data.map((s) => ({
    ...s,
    isSystem: true,
    updatedAt: new Date(),
  }));
  return db.insert(state).values(rows).onConflictDoNothing();
}
