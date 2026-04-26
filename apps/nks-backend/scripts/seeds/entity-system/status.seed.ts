import type { Db } from '../types.js';
import { status } from '../../../src/core/database/schema/entity-system/status/index.js';
import data from './data/business-statuses.js';

export async function seedBusinessStatuses(db: Db) {
  return db.insert(status).values(data).onConflictDoNothing();
}
