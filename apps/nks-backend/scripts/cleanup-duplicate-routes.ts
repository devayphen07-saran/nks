/**
 * Cleanup Script — Remove Duplicate Routes
 *
 * Removes duplicate store routes (ids 11-20) that were seeded twice.
 * Keeps the first occurrence (lowest id) for each routePath.
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/cleanup-duplicate-routes.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and, inArray, ne, sql } from 'drizzle-orm';
import * as schema from '../src/core/database/schema';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  console.log('\n🧹 NKS — Duplicate Route Cleanup');
  console.log('══════════════════════════════════\n');

  // Find all duplicates — group by routePath, keep the MIN id (first inserted)
  const duplicates = await db.execute(sql`
    SELECT route_path, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS all_ids
    FROM routes
    WHERE deleted_at IS NULL
    GROUP BY route_path
    HAVING COUNT(*) > 1
  `);

  const rows = duplicates.rows as Array<{
    route_path: string;
    keep_id: number;
    all_ids: number[];
  }>;

  if (rows.length === 0) {
    console.log('✅ No duplicates found. Database is clean.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} duplicated route path(s):\n`);

  for (const row of rows) {
    const idsToDelete = row.all_ids.filter((id) => id !== Number(row.keep_id));
    console.log(`  route: ${row.route_path}`);
    console.log(`  keeping id=${row.keep_id}, deleting ids=[${idsToDelete.join(', ')}]`);

    // Soft-delete the duplicates
    await db
      .update(schema.routes)
      .set({ deletedAt: new Date() } as any)
      .where(inArray(schema.routes.id, idsToDelete));

    console.log(`  ✅ Removed ${idsToDelete.length} duplicate(s)\n`);
  }

  console.log('══════════════════════════════════');
  console.log('✨ Duplicate cleanup complete!');
  console.log('══════════════════════════════════\n');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
