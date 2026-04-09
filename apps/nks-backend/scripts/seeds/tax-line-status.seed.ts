import type { Db } from './types.js';
import { taxLineStatus } from '../../src/core/database/schema/tax/tax-line-status';

const data = [
  { code: 'PENDING', label: 'Pending', description: 'Recorded but awaiting finance validation' },
  { code: 'APPROVED', label: 'Approved', description: 'Validated by finance/accountant' },
  { code: 'REJECTED', label: 'Rejected', description: 'Disputed — may require a corrective credit note' },
];

export async function seedTaxLineStatuses(db: Db) {
  return db.insert(taxLineStatus).values(data).onConflictDoNothing();
}
