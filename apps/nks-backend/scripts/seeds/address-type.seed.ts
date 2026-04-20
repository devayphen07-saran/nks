import type { Db } from './types.js';
import { addressType } from '../../src/core/database/schema/location/address-type/index.js';
import data from './data/address-types.js';

export async function seedAddressTypes(db: Db) {
  return db.insert(addressType).values(data).onConflictDoNothing();
}
