import type { Db } from './types.js';
import { storeCategory } from '../../src/core/database/schema';

const data = [
  { categoryName: 'Grocery',      categoryCode: 'GROCERY',     sortOrder: 1, isSystem: true },
  { categoryName: 'Pharmacy',     categoryCode: 'PHARMACY',    sortOrder: 2, isSystem: true },
  { categoryName: 'Restaurant',   categoryCode: 'RESTAURANT',  sortOrder: 3, isSystem: true },
  { categoryName: 'Electronics',  categoryCode: 'ELECTRONICS', sortOrder: 4, isSystem: true },
  { categoryName: 'Clothing',     categoryCode: 'CLOTHING',    sortOrder: 5, isSystem: true },
  { categoryName: 'Stationery',   categoryCode: 'STATIONERY',  sortOrder: 6, isSystem: true },
  { categoryName: 'Hardware',     categoryCode: 'HARDWARE',    sortOrder: 7, isSystem: true },
  { categoryName: 'Other',        categoryCode: 'OTHER',       sortOrder: 8, isSystem: true },
];

export async function seedStoreCategories(db: Db) {
  return db.insert(storeCategory).values(data).onConflictDoNothing();
}
