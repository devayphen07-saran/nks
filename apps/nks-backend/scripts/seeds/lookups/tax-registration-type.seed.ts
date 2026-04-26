import type { Db } from '../types.js';
import { taxRegistrationType } from '../../../src/core/database/schema/tax/tax-registration-type/index.js';
import data from './data/tax-registration-types.js';

export async function seedTaxRegistrationTypes(db: Db) {
  return db.insert(taxRegistrationType).values(data).onConflictDoNothing();
}
