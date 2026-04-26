import type { Db } from '../types.js';
import { taxRateMaster, country, commodityCodes, store } from '../../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';

/**
 * Default Tax Rates for Commodity Codes
 *
 * Seeds one default rate per (country, store, commodity) combination.
 * Stores can override these rates via the tax_rate_master table.
 *
 * Note: This seed applies default rates to ALL stores (if any exist).
 * Since stores may not be seeded yet, this may return 0 rows initially.
 * Re-run after stores are created to populate rates.
 */

const ratesByGstPercentage: Record<number, string[]> = {
  0: ['0', '7102'],
  3: ['3', '7108'],
  5: [
    '5',
    '0201', '0302', '0402', '0511', '0703', '0709', '0804', '0901', '0902',
    '1001', '1005', '1006', '1201', '1404', '1507', '1512', '1701', '1806',
    '1905', '0904', '0905', '0906', '0907', '0908', '0910', '2506', '2530',
    '2701', '2801', '2802', '2810', '2847', '7204', '7208', '5008', '5109',
    '5209', '6001', '6201', '6204', '6401', '6402', '6403', '8471', '8517',
    '9957', '9960',
  ],
  12: ['12', '0402', '7326', '6502', '6907', '7007', '7010', '8425', '8470', '8708'],
  18: ['18', '2707', '8527', '9951', '9952', '9954', '9955'],
  28: ['28', '8704', '8711', '8430'],
};

function getIndiaComponentRates(baseTaxRate: string) {
  const rate = parseFloat(baseTaxRate);
  const componentRate = (rate / 2).toFixed(3);
  return {
    component1: componentRate, // CGST
    component2: componentRate, // SGST
    component3: baseTaxRate,   // IGST (full rate for inter-state)
    additional: '0',           // Cess (no default)
  };
}

export async function seedTaxRateMaster(db: Db) {
  const [india] = await db
    .select({ id: country.id })
    .from(country)
    .where(eq(country.isoCode2, 'IN'))
    .limit(1);

  if (!india) {
    throw new Error('seedTaxRateMaster: India country not found. Run seedCountries first.');
  }

  const stores = await db.select({ id: store.id }).from(store);

  if (stores.length === 0) {
    console.log('No stores found. Skipping tax_rate_master seed.');
    return { rowCount: 0 };
  }

  const commodityCodeList = await db
    .select({ id: commodityCodes.id, code: commodityCodes.code, defaultTaxRate: commodityCodes.defaultTaxRate })
    .from(commodityCodes)
    .where(eq(commodityCodes.countryFk, india.id));

  if (commodityCodeList.length === 0) {
    throw new Error('seedTaxRateMaster: No commodity codes found. Run seedCommodityCodes first.');
  }

  const codeToRate: Record<string, string> = {};
  for (const [taxPercent, codes] of Object.entries(ratesByGstPercentage)) {
    for (const code of codes) {
      codeToRate[code] = taxPercent;
    }
  }

  const today = new Date();
  const rates: Array<typeof taxRateMaster.$inferInsert> = [];

  for (const storeRecord of stores) {
    for (const commodity of commodityCodeList) {
      const taxRateStr = commodity.defaultTaxRate || codeToRate[commodity.code] || '18';
      const { component1, component2, component3, additional } = getIndiaComponentRates(taxRateStr);

      rates.push({
        countryFk:       india.id,
        storeFk:         storeRecord.id,
        commodityCodeFk: commodity.id,
        baseTaxRate:     taxRateStr,
        component1Rate:  component1,
        component2Rate:  component2,
        component3Rate:  component3,
        additionalRate:  additional,
        effectiveFrom:   today,
        effectiveTo:     null,
        isActive:        true,
      });
    }
  }

  if (rates.length === 0) return { rowCount: 0 };

  return db.insert(taxRateMaster).values(rates).onConflictDoNothing();
}
