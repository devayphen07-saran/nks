import type { Db } from './types.js';
import { postalCode, administrativeDivision, country } from '../../src/core/database/schema';
import { eq, sql } from 'drizzle-orm';

const POSTAL_CODES: { code: string; cityName: string; divisionName: string }[] = [
  { code: '600001', cityName: 'Chennai', divisionName: 'Chennai' },
  { code: '600002', cityName: 'Chennai', divisionName: 'Chennai' },
  { code: '600020', cityName: 'Chennai', divisionName: 'Chennai' },
  { code: '560001', cityName: 'Bengaluru', divisionName: 'Bengaluru Urban' },
  { code: '560002', cityName: 'Bengaluru', divisionName: 'Bengaluru Urban' },
  { code: '400001', cityName: 'Mumbai', divisionName: 'Mumbai City' },
  { code: '110001', cityName: 'New Delhi', divisionName: 'New Delhi' },
  { code: '700001', cityName: 'Kolkata', divisionName: 'Kolkata' },
  { code: '500001', cityName: 'Hyderabad', divisionName: 'Hyderabad' },
];

export async function seedPincodes(db: Db) {
  // Ensure tables exist
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS postal_code (
        id BIGSERIAL PRIMARY KEY,
        guuid UUID NOT NULL DEFAULT gen_random_uuid(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        sort_order INTEGER DEFAULT 0,
        is_hidden BOOLEAN NOT NULL DEFAULT false,
        is_system BOOLEAN NOT NULL DEFAULT false,
        code VARCHAR(20) NOT NULL,
        city_name VARCHAR(150) NOT NULL,
        administrative_division_fk BIGINT NOT NULL REFERENCES administrative_division(id) ON DELETE RESTRICT,
        state_region_province_fk BIGINT NOT NULL REFERENCES state_region_province(id) ON DELETE RESTRICT,
        country_fk BIGINT NOT NULL REFERENCES country(id) ON DELETE RESTRICT,
        latitude NUMERIC(10, 7),
        longitude NUMERIC(10, 7),
        created_by BIGINT,
        modified_by BIGINT,
        deleted_by BIGINT
      )
    `);
  } catch (err) {
    // Table already exists, continue
  }

  const [india] = await db.select({ id: country.id }).from(country).where(eq(country.isoCode2, 'IN'));
  if (!india) return { rowCount: 0 };

  const divisionRows = await db.select({
    id: administrativeDivision.id,
    divisionName: administrativeDivision.divisionName,
    stateFk: administrativeDivision.stateRegionProvinceFk
  }).from(administrativeDivision);

  const data = POSTAL_CODES.map(p => {
    const d = divisionRows.find(dr => dr.divisionName === p.divisionName);
    if (!d) return null;

    return {
      code: p.code,
      cityName: p.cityName,
      administrativeDivisionFk: d.id,
      stateRegionProvinceFk: d.stateFk,
      countryFk: india.id,
      isSystem: true,
    };
  }).filter(Boolean) as any[];

  if (data.length === 0) return { rowCount: 0 };
  return db.insert(postalCode).values(data).onConflictDoNothing();
}
