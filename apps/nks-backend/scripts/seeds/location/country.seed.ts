import type { Db } from '../types.js';
import { country } from '../../../src/core/database/schema/index.js';
import data from './data/country.js';

export async function seedCountries(db: Db) {
  for (const item of data) {
    await db.insert(country).values(item).onConflictDoUpdate({
      target: country.isoCode2,
      set: {
        countryName:    item.countryName,
        dialCode:       item.dialCode,
        currencyCode:   item.currencyCode,
        currencySymbol: item.currencySymbol,
        timezone:       item.timezone,
        isActive:       item.isActive,
        isSystem:       item.isSystem,
        sortOrder:      item.sortOrder,
      },
    });
  }
  return { rowCount: data.length };
}
