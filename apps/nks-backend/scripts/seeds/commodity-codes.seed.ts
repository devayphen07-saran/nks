import type { Db } from './types.js';
import { commodityCodes, country } from '../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import commodityData from './data/commodity-codes.js';

/**
 * India Commodity Codes (HSN - Harmonized System of Nomenclature)
 *
 * Covers primary goods across major categories:
 *   - Food & Agriculture (0201-0710)
 *   - Minerals & Chemicals (2506-2847)
 *   - Textiles (5008-6204)
 *   - Electronics (8471-8517)
 *   - Vehicles (8704-8711)
 *   - Services (SAC - 9950+)
 *
 * Each linked to default tax rate per commodity classification.
 * Stores can override rates in tax_rate_master for specific needs.
 *
 * Multi-country ready: Type field supports HSN (India), HS (international),
 * CN (EU), and other classification systems per jurisdiction.
 */
export async function seedCommodityCodes(db: Db) {
  // Resolve India country ID
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
