import type { Db } from './types.js';
import { taxLineStatus } from '../../src/core/database/schema/tax/tax-line-status/index.js';
import data from './data/tax-line-statuses.js';

export async function seedTaxLineStatuses(db: Db) {
  return db.insert(taxLineStatus).values(data).onConflictDoNothing();
}
