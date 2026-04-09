import type { Db } from './types.js';
import { contactPersonType } from '../../src/core/database/schema';

const data = [
  { code: 'OWNER',      label: 'Owner',      isSystem: true },
  { code: 'MANAGER',    label: 'Manager',    isSystem: true },
  { code: 'ACCOUNTANT', label: 'Accountant', isSystem: true },
  { code: 'STAFF',      label: 'Staff',      isSystem: true },
  { code: 'OTHER',      label: 'Other',      isSystem: true },
];

export async function seedContactPersonTypes(db: Db) {
  return db.insert(contactPersonType).values(data).onConflictDoNothing();
}
