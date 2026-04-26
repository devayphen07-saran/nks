import type { Db } from '../types.js';
import { planType } from '../../../src/core/database/schema/lookups/plan-type/index.js';
import data from './data/plan-types.js';

export async function seedPlanTypes(db: Db) {
  return db.insert(planType).values(data).onConflictDoNothing();
}
