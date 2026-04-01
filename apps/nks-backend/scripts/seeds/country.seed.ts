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
    isActive: true,
    isSystem: true,
    sortOrder: 1,
  },
  {
    countryName: 'United States',
    isoCode2: 'US',
    dialCode: '+1',
    currencyCode: 'USD',
    currencySymbol: '$',
    timezone: 'America/New_York',
    isActive: false,
    isSystem: true,
    sortOrder: 2,
  },
  {
    countryName: 'United Kingdom',
    isoCode2: 'GB',
    dialCode: '+44',
    currencyCode: 'GBP',
    currencySymbol: '£',
    timezone: 'Europe/London',
    isActive: false,
    isSystem: true,
    sortOrder: 3,
  },
  {
    countryName: 'Canada',
    isoCode2: 'CA',
    dialCode: '+1',
    currencyCode: 'CAD',
    currencySymbol: 'C$',
    timezone: 'America/Toronto',
    isActive: false,
    isSystem: true,
    sortOrder: 4,
  },
  {
    countryName: 'Australia',
    isoCode2: 'AU',
    dialCode: '+61',
    currencyCode: 'AUD',
    currencySymbol: 'A$',
    timezone: 'Australia/Sydney',
    isActive: false,
    isSystem: true,
    sortOrder: 5,
  },
  {
    countryName: 'Singapore',
    isoCode2: 'SG',
    dialCode: '+65',
    currencyCode: 'SGD',
    currencySymbol: 'S$',
    timezone: 'Asia/Singapore',
    isActive: false,
    isSystem: true,
    sortOrder: 6,
  },
  {
    countryName: 'Germany',
    isoCode2: 'DE',
    dialCode: '+49',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Berlin',
    isActive: false,
    isSystem: true,
    sortOrder: 7,
  },
  {
    countryName: 'France',
    isoCode2: 'FR',
    dialCode: '+33',
    currencyCode: 'EUR',
    currencySymbol: '€',
    timezone: 'Europe/Paris',
    isActive: false,
    isSystem: true,
    sortOrder: 8,
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
