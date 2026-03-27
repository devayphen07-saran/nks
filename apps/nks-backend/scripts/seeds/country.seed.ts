import type { Db } from './types';
import { country } from '../../src/core/database/schema';

const data = [
  {
    countryName: 'India',
    isoCode2: 'IN',
    dialCode: '+91',
    currencyCode: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    isSystem: true,
    sortOrder: 1,
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
