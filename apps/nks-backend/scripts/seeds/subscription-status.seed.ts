import type { Db } from './types.js';
import { status } from '../../src/core/database/schema/entity-system/status/index.js';
import data from './data/subscription-statuses.js';

export async function seedSubscriptionStatus(db: Db) {
  return db.insert(status).values(data).onConflictDoNothing();
}
