import type { Db } from '../types.js';
import { billingFrequency } from '../../../src/core/database/schema/lookups/billing-frequency/index.js';
import data from './data/billing-frequencies.js';

export async function seedBillingFrequencies(db: Db) {
  return db.insert(billingFrequency).values(data).onConflictDoNothing();
}
