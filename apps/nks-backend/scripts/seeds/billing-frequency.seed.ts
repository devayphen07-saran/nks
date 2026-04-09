import type { Db } from './types.js';
import { billingFrequency } from '../../src/core/database/schema/lookups/billing-frequency';

const data = [
  { code: 'MONTHLY', label: 'Monthly', description: 'Monthly Billing', days: 30 },
  { code: 'QUARTERLY', label: 'Quarterly', description: 'Quarterly Billing', days: 90 },
  { code: 'SEMI_ANNUAL', label: 'Semi-Annual', description: 'Half-Yearly Billing', days: 180 },
  { code: 'ANNUAL', label: 'Annual', description: 'Yearly Billing', days: 365 },
  { code: 'ONE_TIME', label: 'One-Time', description: 'One-Time Payment', days: 0 },
];

export async function seedBillingFrequencies(db: Db) {
  return db.insert(billingFrequency).values(data).onConflictDoNothing();
}
