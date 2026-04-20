import type { Db } from './types.js';
import { currency } from '../../src/core/database/schema/lookups/currency/index.js';
import data from './data/currencies.js';

export async function seedCurrencies(db: Db) {
  return db.insert(currency).values(data).onConflictDoNothing();
}
