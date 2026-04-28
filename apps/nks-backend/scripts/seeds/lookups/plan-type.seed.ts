import type { Db } from '../types.js';
import { lookup, lookupType } from '../../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import data from './data/plan-types.js';

export async function seedPlanTypes(db: Db) {
  const [type] = await db.select({ id: lookupType.id }).from(lookupType).where(eq(lookupType.code, 'PLAN_TYPE')).limit(1);
  if (!type) throw new Error('lookup_type PLAN_TYPE not seeded — run seedLookupTypes first');
  return db.insert(lookup).values(data.map(d => ({ ...d, lookupTypeFk: type.id, isSystem: true }))).onConflictDoNothing();
}
