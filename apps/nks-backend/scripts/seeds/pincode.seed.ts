import type { Db } from './types.js';
import { pincode, district, state } from '../../src/core/database/schema/index.js';
import PINCODES from './data/pincodes.js';

/**
 * Seed the India-specific pincode table
 */
export async function seedPincodeTable(db: Db) {
  // Check if data already exists
  const count = await db.select({ id: pincode.id })
    .from(pincode)
    .limit(1);

  if (count.length > 0) {
    return { rowCount: 0 };
  }

  // Get all districts and states from the new tables
  const districtRows = await db.select({
    id: district.id,
    districtName: district.districtName,
    stateFk: district.stateFk,
  }).from(district);

  const stateRows = await db.select({
    id: state.id,
    stateName: state.stateName,
  }).from(state);

  const data = PINCODES
    .map(p => {
      const s = stateRows.find(st => st.stateName === p.stateName);
      if (!s) return null;

      const d = districtRows.find(dist => dist.districtName === p.districtName && dist.stateFk === s.id);
      if (!d) return null;

      return {
        code: p.code,
        localityName: p.localityName,
        areaName: p.areaName,
        districtFk: d.id,
        stateFk: s.id,
        isSystem: true,
        updatedAt: new Date(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (data.length === 0) return { rowCount: 0 };
  return db.insert(pincode).values(data).onConflictDoNothing();
}
