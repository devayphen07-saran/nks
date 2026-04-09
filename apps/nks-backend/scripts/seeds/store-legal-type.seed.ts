import type { Db } from './types.js';
import { storeLegalType } from '../../src/core/database/schema/lookups/store-legal-type';

const data = [
  { code: 'PVT_LTD', label: 'Private Limited', description: 'Private Limited Company' },
  { code: 'LLP', label: 'Limited Liability Partnership', description: 'LLP Structure' },
  { code: 'SOLE_PROP', label: 'Sole Proprietorship', description: 'Individual Business' },
  { code: 'PARTNERSHIP', label: 'Partnership', description: 'General Partnership' },
  { code: 'PUBLIC_LTD', label: 'Public Limited', description: 'Public Limited Company' },
  { code: 'OPC', label: 'One Person Company', description: 'Single Member Company' },
  { code: 'NIDHI_CO', label: 'Nidhi Company', description: 'Nidhi Mutual Benefit Society' },
  { code: 'COOPERATIVE', label: 'Cooperative Society', description: 'Cooperative Structure' },
  { code: 'NGO', label: 'Non-Profit Organization', description: 'NGO / Section 8 Company' },
];

export async function seedStoreLegalTypes(db: Db) {
  return db.insert(storeLegalType).values(data).onConflictDoNothing();
}
