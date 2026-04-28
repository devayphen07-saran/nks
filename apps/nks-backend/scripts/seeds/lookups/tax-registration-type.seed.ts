import type { Db } from '../types.js';
import { lookup, lookupType } from '../../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import data from './data/tax-registration-types.js';

export async function seedTaxRegistrationTypes(db: Db) {
  const [type] = await db.select({ id: lookupType.id }).from(lookupType).where(eq(lookupType.code, 'TAX_REGISTRATION_TYPE')).limit(1);
  if (!type) throw new Error('lookup_type TAX_REGISTRATION_TYPE not seeded — run seedLookupTypes first');
  return db.insert(lookup).values(data.map(d => ({ ...d, lookupTypeFk: type.id, isSystem: true }))).onConflictDoNothing();
}
