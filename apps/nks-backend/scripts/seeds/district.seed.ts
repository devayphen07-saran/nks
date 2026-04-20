import type { Db } from './types.js';
import { district, state } from '../../src/core/database/schema/index.js';
import DISTRICTS_BY_STATE from './data/districts.js';

/**
 * Seed the India-specific district table
 */
export async function seedDistrictTable(db: Db) {
  // Check if data already exists
  const count = await db.select({ id: district.id })
    .from(district)
    .limit(1);

  if (count.length > 0) {
    return { rowCount: 0 };
  }

  // Get all states from the new state table
  const stateRows = await db.select({
    id: state.id,
    stateName: state.stateName,
  }).from(state);

  const rows: Array<{ districtName: string; stateFk: number; isSystem: boolean; updatedAt: Date }> = [];

  // Map districts to state FKs
  for (const stateName in DISTRICTS_BY_STATE) {
    const stateRow = stateRows.find(s => s.stateName === stateName);
    if (!stateRow) continue;

    const districts = DISTRICTS_BY_STATE[stateName];
    districts.forEach(districtName => {
      rows.push({
        districtName,
        stateFk: stateRow.id,
        isSystem: true,
        updatedAt: new Date(),
      });
    });
  }

  if (rows.length === 0) return { rowCount: 0 };

  // Insert in batches of 10 to avoid parser limits
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10);
    try {
      const result = await db.insert(district).values(batch).onConflictDoNothing();
      totalInserted += result.rowCount ?? 0;
    } catch (err) {
      console.error(`Failed to insert district batch at index ${i}:`, err);
    }
  }

  return { rowCount: totalInserted };
}
