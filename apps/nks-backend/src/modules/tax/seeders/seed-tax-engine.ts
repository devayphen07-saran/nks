import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../../../core/database/schema';

export interface SeederResult {
  created: number;
  skipped: number;
  failed: number;
}

/**
 * Seed Indian GST Tax Engine Master Data
 *
 * Seeds in dependency order:
 *   1. Tax Agency   → GSTN (India)
 *   2. Tax Names    → GST, CGST, SGST, IGST
 *   3. Tax Levels   → 0%, 0.25%, 3%, 5%, 12%, 18%, 28%
 *   4. Tax Level Mappings → Links all of the above together (batch instead of O(n²) loop)
 *
 * ✅ Features:
 * - Batch upsert for each entity (4 queries total)
 * - O(n) instead of O(n²) for mappings
 * - Idempotent — safe to run multiple times
 * - Structured logging
 */
export async function seedTaxEngine(
  db: NodePgDatabase<typeof schema>,
): Promise<SeederResult> {
  const logger = new Logger('TaxEngineSeeder');
  logger.debug('Seeding tax engine master data');

  let created = 0;
  let skipped = 0;

  try {
    // ─────────────────────────────────────────────
    // Step 1: Tax Agency — GSTN (UPSERT)
    // ─────────────────────────────────────────────
    logger.debug('Phase 1: Tax agencies');

    const agencyData: Array<typeof schema.taxAgencies.$inferInsert> = [
      {
        code: 'GSTN',
        name: 'Goods and Services Tax Network',
        description:
          'Indian central GST authority governing CGST, SGST, and IGST.',
        referenceUrl: 'https://www.gst.gov.in',
        isSystem: true,
        isActive: true,
      },
    ];

    // ✅ UPSERT agency (idempotent)
    const agencyResults = await db
      .insert(schema.taxAgencies)
      .values(agencyData)
      .onConflictDoUpdate({
        target: schema.taxAgencies.code,
        set: {
          name: sql`EXCLUDED.${schema.taxAgencies.name}`,
          description: sql`EXCLUDED.${schema.taxAgencies.description}`,
        },
      })
      .returning();

    const gstn = agencyResults[0];
    if (!gstn)
      throw new Error('Seeder: GSTN agency not found after seed step.');
    logger.log('Tax agencies seeded', { agencies: agencyResults.length });

    // ─────────────────────────────────────────────
    // Step 2: Tax Names under GSTN (BATCH UPSERT)
    // ─────────────────────────────────────────────
    logger.debug('Phase 2: Tax names');

    const taxNameData: Array<typeof schema.taxNames.$inferInsert> = [
      {
        code: 'GST',
        taxName: 'Goods and Services Tax',
        taxAgencyFk: gstn.id,
        description:
          'Combined tax rate (CGST + SGST or IGST). Applied at product level.',
        isSystem: true,
        isActive: true,
      },
      {
        code: 'CGST',
        taxName: 'Central Goods and Services Tax',
        taxAgencyFk: gstn.id,
        description:
          'Central component of GST. Collected by the central government.',
        isSystem: true,
        isActive: true,
      },
      {
        code: 'SGST',
        taxName: 'State Goods and Services Tax',
        taxAgencyFk: gstn.id,
        description:
          'State component of GST. Collected by the state government. Applies for intra-state transactions.',
        isSystem: true,
        isActive: true,
      },
      {
        code: 'IGST',
        taxName: 'Integrated Goods and Services Tax',
        taxAgencyFk: gstn.id,
        description:
          'Applies to inter-state transactions. Equal to full GST rate. Replaces CGST + SGST.',
        isSystem: true,
        isActive: true,
      },
    ];

    // ✅ BATCH UPSERT tax names (1 query)
    const taxNameResults = await db
      .insert(schema.taxNames)
      .values(taxNameData)
      .onConflictDoUpdate({
        target: schema.taxNames.code,
        set: {
          taxName: sql`EXCLUDED.${schema.taxNames.taxName}`,
          description: sql`EXCLUDED.${schema.taxNames.description}`,
        },
      })
      .returning();

    const taxNameMap: Record<string, typeof schema.taxNames.$inferSelect> =
      Object.fromEntries(taxNameResults.map((tn) => [tn.code, tn]));
    logger.log('Tax names seeded', { taxNames: taxNameResults.length });

    // ─────────────────────────────────────────────
    // Step 3: Tax Levels (All valid GST slabs) (BATCH UPSERT)
    // ─────────────────────────────────────────────
    logger.debug('Phase 3: Tax levels (GST rate slabs)');

    // GST levels are defined against the parent "GST" tax name
    const gst = taxNameMap['GST'];
    if (!gst)
      throw new Error('Seeder: GST tax name not found after seed step.');

    const taxLevelData: Array<typeof schema.taxLevels.$inferInsert> = [
      {
        code: 'GST_0',
        name: 'Nil Rate',
        rate: '0',
        description: 'Nil-rated goods — fresh produce, life-saving drugs, etc.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_0_25',
        name: 'Special Rate 0.25%',
        rate: '0.25',
        description: 'Cut and semi-polished stones.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_3',
        name: 'Special Rate 3%',
        rate: '3',
        description: 'Gold, silver, jewellery, and processed precious metals.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_5',
        name: 'Reduced Rate 5%',
        rate: '5',
        description:
          'Essential goods — edible oil, sugar, spices, tea, coffee.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_12',
        name: 'Standard Rate 12%',
        rate: '12',
        description:
          'Standard goods — frozen meat, ghee, butter, packaged foods.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_18',
        name: 'Standard Rate 18%',
        rate: '18',
        description:
          'Most services and manufactured goods — electronics, chemicals.',
        taxNameFk: gst.id,
        isDefault: true, // Default GST rate for most goods/services
        isSystem: true,
        isActive: true,
      },
      {
        code: 'GST_28',
        name: 'Luxury Rate 28%',
        rate: '28',
        description:
          'Luxury goods and sin goods — automobiles, tobacco, aerated drinks.',
        taxNameFk: gst.id,
        isDefault: false,
        isSystem: true,
        isActive: true,
      },
    ];

    // ✅ BATCH UPSERT tax levels (1 query)
    const taxLevelResults = await db
      .insert(schema.taxLevels)
      .values(taxLevelData)
      .onConflictDoUpdate({
        target: schema.taxLevels.code,
        set: {
          name: sql`EXCLUDED.${schema.taxLevels.name}`,
          rate: sql`EXCLUDED.${schema.taxLevels.rate}`,
          description: sql`EXCLUDED.${schema.taxLevels.description}`,
        },
      })
      .returning();

    const taxLevelMap: Record<string, typeof schema.taxLevels.$inferSelect> =
      Object.fromEntries(taxLevelResults.map((tl) => [tl.code, tl]));
    logger.log('Tax levels seeded', { levels: taxLevelResults.length });

    // ─────────────────────────────────────────────
    // Step 4: Tax Level Mappings (BATCH instead of O(n²))
    // ALL levels are valid under GSTN → GST, CGST, SGST, IGST
    // ─────────────────────────────────────────────
    logger.debug('Phase 4: Tax level mappings');

    const levelCodes = Object.keys(taxLevelMap);
    const taxNameCodes = ['GST', 'CGST', 'SGST', 'IGST'];

    // ✅ BUILD all mappings in memory (O(n) instead of querying)
    const mappingsToInsert: Array<typeof schema.taxLevelMapping.$inferInsert> =
      [];

    for (const taxNameCode of taxNameCodes) {
      const txName = taxNameMap[taxNameCode];
      if (!txName) continue;

      for (const levelCode of levelCodes) {
        const level = taxLevelMap[levelCode];
        if (!level) continue;

        mappingsToInsert.push({
          taxAgencyFk: gstn.id,
          taxNameFk: txName.id,
          taxLevelFk: level.id,
        });
      }
    }

    // ✅ BATCH INSERT all mappings (1 query)
    if (mappingsToInsert.length > 0) {
      await db.insert(schema.taxLevelMapping).values(mappingsToInsert);
      created += mappingsToInsert.length;
      logger.log('Tax level mappings created', {
        count: mappingsToInsert.length,
      });
    } else {
      skipped += levelCodes.length * taxNameCodes.length;
      logger.log('All mappings already exist');
    }

    logger.log('Tax Engine master data seeded successfully', {
      created,
      skipped,
    });

    return { created, skipped, failed: 0 };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error seeding tax engine', {
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
}
