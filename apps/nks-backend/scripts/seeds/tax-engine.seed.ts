import type { Db } from './types.js';
import { taxAgencies, taxNames, taxLevels, taxLevelMapping } from '../../src/core/database/schema/index.js';
import { eq } from 'drizzle-orm';
import { agencyData, taxNameData, taxLevelData } from './data/tax-engine.js';

/**
 * Seed the tax engine master data:
 *   1. GSTN Tax Agency
 *   2. GST, CGST, SGST, IGST Tax Names
 *   3. GST rate levels (0%, 0.25%, 3%, 5%, 12%, 18%, 28%)
 *   4. Tax level mappings (agency → name → level)
 *
 * Idempotent — safe to run multiple times via onConflictDoNothing.
 */
export async function seedTaxAgencies(db: Db) {
  return db.insert(taxAgencies).values(agencyData).onConflictDoNothing();
}

export async function seedTaxNames(db: Db) {
  // Resolve the GSTN agency ID at runtime
  const [gstn] = await db.select().from(taxAgencies).where(eq(taxAgencies.code, 'GSTN')).limit(1);
  if (!gstn) throw new Error('seedTaxNames: GSTN agency not found. Run seedTaxAgencies first.');

  const data = taxNameData.map((n) => ({ ...n, taxAgencyFk: gstn.id }));
  return db.insert(taxNames).values(data).onConflictDoNothing();
}

export async function seedTaxLevels(db: Db) {
  // All levels are children of the "GST" tax name
  const [gst] = await db.select().from(taxNames).where(eq(taxNames.code, 'GST')).limit(1);
  if (!gst) throw new Error('seedTaxLevels: GST tax name not found. Run seedTaxNames first.');

  const data = taxLevelData.map((l) => ({ ...l, taxNameFk: gst.id }));
  return db.insert(taxLevels).values(data).onConflictDoNothing();
}

export async function seedTaxLevelMappings(db: Db) {
  const [gstn] = await db.select().from(taxAgencies).where(eq(taxAgencies.code, 'GSTN')).limit(1);
  if (!gstn) throw new Error('seedTaxLevelMappings: GSTN not found.');

  const allNames  = await db.select().from(taxNames).where(eq(taxNames.taxAgencyFk, gstn.id));
  const allLevels = await db.select().from(taxLevels);

  const mappings: Array<typeof taxLevelMapping.$inferInsert> = [];

  for (const txName of allNames) {
    for (const level of allLevels) {
      mappings.push({
        taxAgencyFk: gstn.id,
        taxNameFk:   txName.id,
        taxLevelFk:  level.id,
      });
    }
  }

  if (mappings.length === 0) return { rowCount: 0 };
  return db.insert(taxLevelMapping).values(mappings).onConflictDoNothing();
}
