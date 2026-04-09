import { currency } from '../../src/core/database/schema/lookups/currency/index.js';
import type { Db } from './types.js';

const data = [
  { code: 'INR', symbol: '₹', description: 'Indian Rupee', sortOrder: 1, isSystem: true },
  { code: 'USD', symbol: '$', description: 'US Dollar', sortOrder: 2, isSystem: true },
  { code: 'EUR', symbol: '€', description: 'Euro', sortOrder: 3, isSystem: true },
  { code: 'GBP', symbol: '£', description: 'British Pound', sortOrder: 4, isSystem: true },
  { code: 'AUD', symbol: 'AU$', description: 'Australian Dollar', sortOrder: 5, isSystem: true },
  { code: 'CAD', symbol: 'C$', description: 'Canadian Dollar', sortOrder: 6, isSystem: true },
  { code: 'SGD', symbol: 'S$', description: 'Singapore Dollar', sortOrder: 7, isSystem: true },
  { code: 'JPY', symbol: '¥', description: 'Japanese Yen', sortOrder: 8, isSystem: true },
];

export async function seedCurrencies(db: Db) {
  return db.insert(currency).values(data).onConflictDoNothing();
}
