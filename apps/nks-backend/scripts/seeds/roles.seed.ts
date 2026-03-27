import type { Db } from './types.js';
import { roles } from '../../src/core/database/schema';

const data = [
  { code: 'SUPER_ADMIN',   roleName: 'Super Admin',   description: 'Full system access',  isSystem: true },
  { code: 'ADMIN',         roleName: 'Admin',         description: 'Company admin',       isSystem: true },
  { code: 'STORE_OWNER',   roleName: 'Store Owner',   description: 'Store owner role',    isSystem: true },
  { code: 'STORE_MANAGER', roleName: 'Store Manager', description: 'Manages a store',     isSystem: true },
  { code: 'CASHIER',       roleName: 'Cashier',       description: 'POS cashier',         isSystem: true },
  { code: 'DELIVERY',      roleName: 'Delivery Staff', description: 'Delivery personnel', isSystem: true },
  { code: 'CUSTOMER',      roleName: 'Customer',      description: 'End customer',        isSystem: true },
];

export async function seedRoles(db: Db) {
  return db.insert(roles).values(data).onConflictDoNothing();
}
