import type { Db } from './types.js';
import { communicationType } from '../../src/core/database/schema/index.js';
import data from './data/communication-types.js';

export async function seedCommunicationTypes(db: Db) {
  return db.insert(communicationType).values(data).onConflictDoNothing();
}
