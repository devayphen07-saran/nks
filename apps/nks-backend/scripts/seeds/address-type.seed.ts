import type { Db } from './types.js';
import { addressType } from '../../src/core/database/schema/location/address-type';

const data = [
  { code: 'HOME', label: 'Home', description: 'Residential Address', isShippingApplicable: true },
  { code: 'OFFICE', label: 'Office', description: 'Business/Office Address', isShippingApplicable: true },
  { code: 'BILLING', label: 'Billing', description: 'Billing Address', isShippingApplicable: false },
  { code: 'SHIPPING', label: 'Shipping', description: 'Shipping Address', isShippingApplicable: true },
  { code: 'WAREHOUSE', label: 'Warehouse', description: 'Warehouse/Storage', isShippingApplicable: true },
  { code: 'FACTORY', label: 'Factory', description: 'Manufacturing Facility', isShippingApplicable: false },
  { code: 'OTHER', label: 'Other', description: 'Other Address Type', isShippingApplicable: true },
];

export async function seedAddressTypes(db: Db) {
  return db.insert(addressType).values(data).onConflictDoNothing();
}
