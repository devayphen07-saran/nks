import type { Db } from './types.js';
import { taxFilingFrequency } from '../../src/core/database/schema/tax/tax-filing-frequency';

const data = [
  { code: 'MONTHLY', label: 'Monthly', description: 'Monthly GST Return (GSTR-1, GSTR-3B)', filingDays: 30 },
  { code: 'QUARTERLY', label: 'Quarterly', description: 'Quarterly GST Return (GSTR-1)', filingDays: 90 },
  { code: 'HALF_YEARLY', label: 'Half-Yearly', description: 'Half-Yearly Return', filingDays: 180 },
  { code: 'ANNUAL', label: 'Annual', description: 'Annual Return (GSTR-9)', filingDays: 365 },
];

export async function seedTaxFilingFrequencies(db: Db) {
  return db.insert(taxFilingFrequency).values(data).onConflictDoNothing();
}
