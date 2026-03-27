import { addressType } from '../../src/core/database/schema';
import type { Db } from './types.js';

const data = [
  { addressTypeName: 'Home',      addressTypeCode: 'HOME',      sortOrder: 1, isSystem: true },
  { addressTypeName: 'Office',    addressTypeCode: 'OFFICE',    sortOrder: 2, isSystem: true },
  { addressTypeName: 'Shipping',  addressTypeCode: 'SHIPPING',  sortOrder: 3, isSystem: true },
  { addressTypeName: 'Billing',   addressTypeCode: 'BILLING',   sortOrder: 4, isSystem: true },
  { addressTypeName: 'Store',     addressTypeCode: 'STORE',     sortOrder: 5, isSystem: true },
  { addressTypeName: 'Warehouse', addressTypeCode: 'WAREHOUSE', sortOrder: 6, isSystem: true },
];

export async function seedAddressTypes(db: Db) {
  return db.insert(addressType).values(data).onConflictDoNothing();
}
