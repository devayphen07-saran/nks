import type { Db } from '../types.js';
import { lookup, lookupType } from '../../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import data from './data/customer-types.js';

export async function seedCustomerTypes(db: Db) {
  const [type] = await db
    .select({ id: lookupType.id })
    .from(lookupType)
    .where(eq(lookupType.code, 'CUSTOMER_TYPE'))
    .limit(1);
  if (!type) throw new Error('lookup_type CUSTOMER_TYPE not seeded — run seedLookupTypes first');
  return db
    .insert(lookup)
    .values(data.map((d) => ({ ...d, lookupTypeFk: type.id, isSystem: true })))
    .onConflictDoNothing();
}
