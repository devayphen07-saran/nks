import type { Db } from './types.js';
import { taxFilingFrequency } from '../../src/core/database/schema/tax/tax-filing-frequency/index.js';
import data from './data/tax-filing-frequencies.js';

export async function seedTaxFilingFrequencies(db: Db) {
  return db.insert(taxFilingFrequency).values(data).onConflictDoNothing();
}
