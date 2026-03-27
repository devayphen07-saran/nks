import type { Db } from './types.js';
import { stateRegionProvince, country } from '../../src/core/database/schema';
import { eq } from 'drizzle-orm';

// 28 States + 8 Union Territories of India
const STATES = [
  // ─── States ──────────────────────────────────────────────────────────────
  { stateName: 'Andhra Pradesh', stateCode: 'AP' },
  { stateName: 'Arunachal Pradesh', stateCode: 'AR' },
  { stateName: 'Assam', stateCode: 'AS' },
  { stateName: 'Bihar', stateCode: 'BR' },
  { stateName: 'Chhattisgarh', stateCode: 'CG' },
  { stateName: 'Goa', stateCode: 'GA' },
  { stateName: 'Gujarat', stateCode: 'GJ' },
  { stateName: 'Haryana', stateCode: 'HR' },
  { stateName: 'Himachal Pradesh', stateCode: 'HP' },
  { stateName: 'Jharkhand', stateCode: 'JH' },
  { stateName: 'Karnataka', stateCode: 'KA' },
  { stateName: 'Kerala', stateCode: 'KL' },
  { stateName: 'Madhya Pradesh', stateCode: 'MP' },
  { stateName: 'Maharashtra', stateCode: 'MH' },
  { stateName: 'Manipur', stateCode: 'MN' },
  { stateName: 'Meghalaya', stateCode: 'ML' },
  { stateName: 'Mizoram', stateCode: 'MZ' },
  { stateName: 'Nagaland', stateCode: 'NL' },
  { stateName: 'Odisha', stateCode: 'OD' },
  { stateName: 'Punjab', stateCode: 'PB' },
  { stateName: 'Rajasthan', stateCode: 'RJ' },
  { stateName: 'Sikkim', stateCode: 'SK' },
  { stateName: 'Tamil Nadu', stateCode: 'TN' },
  { stateName: 'Telangana', stateCode: 'TS' },
  { stateName: 'Tripura', stateCode: 'TR' },
  { stateName: 'Uttar Pradesh', stateCode: 'UP' },
  { stateName: 'Uttarakhand', stateCode: 'UK' },
  { stateName: 'West Bengal', stateCode: 'WB' },
  // ─── Union Territories ───────────────────────────────────────────────────
  { stateName: 'Andaman and Nicobar Islands', stateCode: 'AN' },
  { stateName: 'Chandigarh', stateCode: 'CH' },
  { stateName: 'Dadra and Nagar Haveli and Daman and Diu', stateCode: 'DH' },
  { stateName: 'Delhi', stateCode: 'DL' },
  { stateName: 'Jammu and Kashmir', stateCode: 'JK' },
  { stateName: 'Ladakh', stateCode: 'LA' },
  { stateName: 'Lakshadweep', stateCode: 'LD' },
  { stateName: 'Puducherry', stateCode: 'PY' },
];

export async function seedStates(db: Db) {
  const [india] = await db
    .select({ id: country.id })
    .from(country)
    .where(eq(country.isoCode2, 'IN'));
  if (!india)
    throw new Error('Country "IN" not found — run seedCountries first');

  const rows = STATES.map((s) => ({ ...s, countryFk: india.id, isSystem: true }));
  return db.insert(stateRegionProvince).values(rows).onConflictDoNothing();
}
