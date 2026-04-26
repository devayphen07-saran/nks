import type { Db } from '../types.js';
import { commodityCodes, country } from '../../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import commodityData from './data/commodity-codes.js';

export async function seedCommodityCodes(db: Db) {
  const [india] = await db
    .select({ id: country.id })
    .from(country)
    .where(eq(country.isoCode2, 'IN'))
    .limit(1);

  if (!india) {
    throw new Error('seedCommodityCodes: India country not found. Run seedCountries first.');
  }

  const data: Array<typeof commodityCodes.$inferInsert> = commodityData.map((c) => ({
    ...c,
    countryFk: india.id,
    isExempted: false,
  }));

  return db.insert(commodityCodes).values(data).onConflictDoNothing();
}
