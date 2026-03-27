import type { Db } from './types.js';
import { designation } from '../../src/core/database/schema';

const data = [
  { designationName: 'CEO',             designationCode: 'CEO',        sortOrder: 1, isSystem: true },
  { designationName: 'Managing Director', designationCode: 'MD',       sortOrder: 2, isSystem: true },
  { designationName: 'Store Manager',   designationCode: 'STORE_MGR',  sortOrder: 3, isSystem: true },
  { designationName: 'Sales Executive', designationCode: 'SALES_EXEC', sortOrder: 4, isSystem: true },
  { designationName: 'Accountant',      designationCode: 'ACCOUNTANT', sortOrder: 5, isSystem: true },
  { designationName: 'Cashier',         designationCode: 'CASHIER',    sortOrder: 6, isSystem: true },
  { designationName: 'Delivery Staff',  designationCode: 'DELIVERY',   sortOrder: 7, isSystem: true },
];

export async function seedDesignations(db: Db) {
  return db.insert(designation).values(data).onConflictDoNothing();
}
