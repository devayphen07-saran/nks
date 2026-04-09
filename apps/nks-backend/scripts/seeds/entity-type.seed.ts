import type { Db } from './types.js';
import { entityType } from '../../src/core/database/schema/lookups/entity-type';

const data = [
  { code: 'INVOICE', label: 'Invoice', description: 'Sales/Purchase invoices' },
  { code: 'PRODUCT', label: 'Product', description: 'Product master data' },
  { code: 'PURCHASE_ORDER', label: 'Purchase Order', description: 'Purchase orders' },
  { code: 'REPORT', label: 'Report', description: 'Business reports and analytics' },
  { code: 'CUSTOMER', label: 'Customer', description: 'Customer records' },
  { code: 'VENDOR', label: 'Vendor', description: 'Vendor/Supplier records' },
  { code: 'INVENTORY', label: 'Inventory', description: 'Inventory and stock management' },
  { code: 'TRANSACTION', label: 'Transaction', description: 'Sales/Purchase transactions' },
  { code: 'PAYMENT', label: 'Payment', description: 'Payment records' },
];

export async function seedEntityTypes(db: Db) {
  return db.insert(entityType).values(data).onConflictDoNothing();
}
