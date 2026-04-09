import type { Db } from './types.js';
import { pincode, district, state } from '../../src/core/database/schema/index.js';

/**
 * Seed the India-specific pincode table
 */
const PINCODES_WITH_LOCALITY: { code: string; localityName: string; areaName?: string; districtName: string; stateName: string }[] = [
  // Chennai
  { code: '600001', localityName: 'Connaught Place', areaName: 'Central Chennai', districtName: 'Chennai', stateName: 'Tamil Nadu' },
  { code: '600002', localityName: 'Parry Corner', areaName: 'North Chennai', districtName: 'Chennai', stateName: 'Tamil Nadu' },
  { code: '600020', localityName: 'Mount Road', areaName: 'Central Chennai', districtName: 'Chennai', stateName: 'Tamil Nadu' },
  // Bengaluru
  { code: '560001', localityName: 'MG Road', areaName: 'Central Bengaluru', districtName: 'Bengaluru Urban', stateName: 'Karnataka' },
  { code: '560002', localityName: 'Cubbon Park', areaName: 'Central Bengaluru', districtName: 'Bengaluru Urban', stateName: 'Karnataka' },
  // Mumbai
  { code: '400001', localityName: 'Fort', areaName: 'South Mumbai', districtName: 'Mumbai City', stateName: 'Maharashtra' },
  // Delhi
  { code: '110001', localityName: 'Connaught Place', areaName: 'Central Delhi', districtName: 'New Delhi', stateName: 'Delhi' },
  // Kolkata
  { code: '700001', localityName: 'Esplanade', areaName: 'Central Kolkata', districtName: 'Kolkata', stateName: 'West Bengal' },
  // Hyderabad
  { code: '500001', localityName: 'Secunderabad', areaName: 'Central Hyderabad', districtName: 'Hyderabad', stateName: 'Telangana' },
];

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

  const data = PINCODES_WITH_LOCALITY.map(p => {
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
  }).filter(Boolean) as any[];

  if (data.length === 0) return { rowCount: 0 };
  return db.insert(pincode).values(data).onConflictDoNothing();
}
