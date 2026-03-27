import { entity } from '../../src/core/database/schema';
import type { Db } from './types.js';

const data = [
  { entityName: 'users',            description: 'User accounts',    sortOrder: 1, isSystem: true },
  { entityName: 'store',            description: 'Stores / tenants', sortOrder: 2, isSystem: true },
  { entityName: 'contact_person',   description: 'Contact persons',  sortOrder: 3, isSystem: true },
  { entityName: 'customers',        description: 'Customer records', sortOrder: 4, isSystem: true },
  { entityName: 'suppliers',        description: 'Supplier records', sortOrder: 5, isSystem: true },
  { entityName: 'products',         description: 'Product catalog',  sortOrder: 6, isSystem: true },
  { entityName: 'orders',           description: 'Sales orders',     sortOrder: 7, isSystem: true },
  { entityName: 'purchase_orders',  description: 'Purchase orders',  sortOrder: 8, isSystem: true },
  { entityName: 'invoices',         description: 'Invoices',         sortOrder: 9, isSystem: true },
];

export async function seedEntities(db: Db) {
  return db.insert(entity).values(data).onConflictDoNothing();
}
