import type { Db } from './types.js';
import { contactPersonType } from '../../src/core/database/schema';

const data = [
  { contactPersonTypeName: 'Owner',      contactPersonTypeCode: 'OWNER',      canReceiveAlerts: true,  isSystem: true },
  { contactPersonTypeName: 'Manager',    contactPersonTypeCode: 'MANAGER',    canReceiveAlerts: true,  isSystem: true },
  { contactPersonTypeName: 'Accountant', contactPersonTypeCode: 'ACCOUNTANT', canReceiveAlerts: true,  isSystem: true },
  { contactPersonTypeName: 'Staff',      contactPersonTypeCode: 'STAFF',      canReceiveAlerts: false, isSystem: true },
  { contactPersonTypeName: 'Other',      contactPersonTypeCode: 'OTHER',      canReceiveAlerts: false, isSystem: true },
];

export async function seedContactPersonTypes(db: Db) {
  return db.insert(contactPersonType).values(data).onConflictDoNothing();
}
