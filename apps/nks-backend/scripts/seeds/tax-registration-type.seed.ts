import type { Db } from './types.js';
import { taxRegistrationType } from '../../src/core/database/schema/tax/tax-registration-type';

const data = [
  { code: 'REGULAR', label: 'Regular', description: 'Regular GST Registration' },
  { code: 'COMPOSITION', label: 'Composition', description: 'Composition Scheme (Turnover < 1.5 Cr)' },
  { code: 'EXEMPT', label: 'Exempt', description: 'GST Exempt Entity' },
  { code: 'SEZ', label: 'SEZ', description: 'Special Economic Zone' },
  { code: 'SPECIAL', label: 'Special', description: 'Special Category Registration' },
];

export async function seedTaxRegistrationTypes(db: Db) {
  return db.insert(taxRegistrationType).values(data).onConflictDoNothing();
}
