import type { Db } from '../types.js';
import { pincode, district, state } from '../../../src/core/database/schema/index.js';
import PINCODES from './data/pincodes.js';

export async function seedPincodeTable(db: Db) {
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
        isSystem: true,
        updatedAt: new Date(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (data.length === 0) return { rowCount: 0 };
  return db.insert(pincode).values(data).onConflictDoNothing();
}
