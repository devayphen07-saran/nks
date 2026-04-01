import type { Db } from './types.js';
import { taxAgencies, taxNames, taxLevels, taxLevelMapping } from '../../src/core/database/schema';
import { eq, and } from 'drizzle-orm';

// ── 1. Agency ──────────────────────────────────────────────────
const agencyData = [
  {
    code: 'GSTN',
    name: 'Goods and Services Tax Network',
    description: 'Indian central GST authority governing CGST, SGST, and IGST.',
    referenceUrl: 'https://www.gst.gov.in',
    isSystem: true,
  },
];

// ── 2. Tax Names ────────────────────────────────────────────────
// taxAgencyFk is resolved at runtime after agency insert
const taxNameData = [
  { code: 'GST',   taxName: 'Goods and Services Tax',            description: 'Combined rate applied at the product level.', isSystem: true },
  { code: 'CGST',  taxName: 'Central Goods and Services Tax',    description: 'Central component — collected by the central government.', isSystem: true },
  { code: 'SGST',  taxName: 'State Goods and Services Tax',      description: 'State component — applies to intra-state transactions.', isSystem: true },
  { code: 'IGST',  taxName: 'Integrated Goods and Services Tax', description: 'Applies to inter-state transactions. Equal to full GST rate.', isSystem: true },
  { code: 'UTGST', taxName: 'Union Territory Goods and Services Tax', description: 'Applies to UTs without legislature (e.g., Ladakh).', isSystem: true },
];

// ── 3. Tax Levels (supporting 2026 slabs) ────────────────────────
// taxNameFk (→GST) is resolved at runtime
const taxLevelData = [
  { code: 'GST_0',    name: 'Nil Rate',            rate: '0',    description: 'Nil-rated goods — fresh produce, life-saving drugs.', isDefault: false, isSystem: true },
  { code: 'GST_0_25', name: 'Special Rate 0.25%',  rate: '0.25', description: 'Cut and semi-polished stones.',                       isDefault: false, isSystem: true },
  { code: 'GST_3',    name: 'Special Rate 3%',      rate: '3',    description: 'Gold, silver, jewellery.',                            isDefault: false, isSystem: true },
  { code: 'GST_5',    name: 'Reduced Rate 5%',      rate: '5',    description: 'Essential goods — edible oil, sugar, tea, coffee.',   isDefault: false, isSystem: true },
  { code: 'GST_12',   name: 'Standard Rate 12%',    rate: '12',   description: 'Standard goods — ghee, butter, packaged foods.',      isDefault: false, isSystem: true },
  { code: 'GST_18',   name: 'Standard Rate 18%',    rate: '18',   description: 'Most services and manufactured goods.',               isDefault: true,  isSystem: true },
  { code: 'GST_40',   name: 'Sin Tax 40%',          rate: '40',   description: 'High-sin goods (Soda, Tobacco) — replaces 28% + Cess.', isDefault: false, isSystem: true },
];

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
