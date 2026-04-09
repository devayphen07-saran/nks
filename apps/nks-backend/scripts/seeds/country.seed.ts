import type { Db } from './types';
import { country } from '../../src/core/database/schema';

/**
 * Single-Country Configuration: India Only
 * This system is designed for India operations exclusively.
 * All location data (states, districts, postal codes) and tax configuration (GST)
 * are scoped to India. To support other countries, remove this configuration
 * and restore the multi-country seed data.
 */
const data = [
  {
    countryName: 'India',
    isoCode2: 'IN',
    dialCode: '+91',
    currencyCode: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    isActive: true,
    isSystem: true,
    sortOrder: 1,
    updatedAt: new Date(),
  },
];

export async function seedCountries(db: Db) {
  for (const item of data) {
    await db.insert(country).values(item).onConflictDoUpdate({
      target: country.isoCode2,
      set: item,
    });
  }
  return { rowCount: data.length };
}
