import type { Db } from './types.js';
import { pincode, district, country } from '../../src/core/database/schema';
import { eq, and } from 'drizzle-orm';

const PINCODES: { postalCode: string; cityName: string; districtName: string }[] = [
  { postalCode: '600001', cityName: 'Chennai', districtName: 'Chennai' },
  { postalCode: '600002', cityName: 'Chennai', districtName: 'Chennai' },
  { postalCode: '600020', cityName: 'Chennai', districtName: 'Chennai' },
  { postalCode: '560001', cityName: 'Bengaluru', districtName: 'Bengaluru Urban' },
  { postalCode: '560002', cityName: 'Bengaluru', districtName: 'Bengaluru Urban' },
  { postalCode: '400001', cityName: 'Mumbai', districtName: 'Mumbai City' },
  { postalCode: '110001', cityName: 'New Delhi', districtName: 'New Delhi' },
  { postalCode: '700001', cityName: 'Kolkata', districtName: 'Kolkata' },
  { postalCode: '500001', cityName: 'Hyderabad', districtName: 'Hyderabad' },
];

export async function seedPincodes(db: Db) {
  const [india] = await db.select({ id: country.id }).from(country).where(eq(country.isoCode2, 'IN'));
  if (!india) return { rowCount: 0 };

  const districtRows = await db.select({ 
    id: district.id, 
    districtName: district.districtName,
    stateFk: district.stateRegionProvinceFk 
  }).from(district);

  const data = PINCODES.map(p => {
    const d = districtRows.find(dr => dr.districtName === p.districtName);
    if (!d) return null;

    return {
      postalCode: p.postalCode,
      cityName: p.cityName,
      districtFk: d.id,
      stateRegionProvinceFk: d.stateFk,
      countryFk: india.id,
      isSystem: true,
    };
  }).filter(Boolean) as any[];

  if (data.length === 0) return { rowCount: 0 };
  return db.insert(pincode).values(data).onConflictDoNothing();
}
