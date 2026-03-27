import type { Db } from './types.js';
import { storeLegalType } from '../../src/core/database/schema';

const data = [
  { legalTypeName: 'Sole Proprietor', legalTypeCode: 'SOLE_PROP',   sortOrder: 1, isSystem: true },
  { legalTypeName: 'Partnership',     legalTypeCode: 'PARTNERSHIP', sortOrder: 2, isSystem: true },
  { legalTypeName: 'Pvt Ltd',         legalTypeCode: 'PVT_LTD',     sortOrder: 3, isSystem: true },
  { legalTypeName: 'LLP',             legalTypeCode: 'LLP',         sortOrder: 4, isSystem: true },
  { legalTypeName: 'Public Limited',  legalTypeCode: 'PUBLIC_LTD',  sortOrder: 5, isSystem: true },
  { legalTypeName: 'Trust / Society', legalTypeCode: 'TRUST',       sortOrder: 6, isSystem: true },
  { legalTypeName: 'Individual',      legalTypeCode: 'INDIVIDUAL',  sortOrder: 7, isSystem: true },
];

export async function seedStoreLegalTypes(db: Db) {
  return db.insert(storeLegalType).values(data).onConflictDoNothing();
}
