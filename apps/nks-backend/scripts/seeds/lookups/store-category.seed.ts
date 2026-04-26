import type { Db } from '../types.js';
import { storeCategory } from '../../../src/core/database/schema/lookups/store-category/index.js';
import data from './data/store-categories.js';

export async function seedStoreCategories(db: Db) {
  return db.insert(storeCategory).values(data).onConflictDoNothing();
}
