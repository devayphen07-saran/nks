import type { Db } from '../types.js';
import { district, state } from '../../../src/core/database/schema/index.js';
import DISTRICTS_BY_STATE from './data/districts.js';

export async function seedDistrictTable(db: Db) {
  const stateRows = await db.select({
    id: state.id,
    stateName: state.stateName,
  }).from(state);

  const rows: Array<{ districtName: string; stateFk: number; isSystem: boolean; updatedAt: Date }> = [];

  for (const stateName in DISTRICTS_BY_STATE) {
    const stateRow = stateRows.find(s => s.stateName === stateName);
    if (!stateRow) continue;

    for (const districtName of DISTRICTS_BY_STATE[stateName]) {
      rows.push({
        districtName,
        stateFk: stateRow.id,
        isSystem: true,
        updatedAt: new Date(),
      });
    }
  }

  if (rows.length === 0) return { rowCount: 0 };

  const BATCH = 500;
  let totalInserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const result = await db
      .insert(district)
      .values(rows.slice(i, i + BATCH))
      .onConflictDoNothing();
    totalInserted += result.rowCount ?? 0;
  }

  return { rowCount: totalInserted };
}
