import type { Db } from './types.js';
import { notificationStatus } from '../../src/core/database/schema/lookups/notification-status/index.js';
import data from './data/notification-statuses.js';

export async function seedNotificationStatuses(db: Db) {
  return db.insert(notificationStatus).values(data).onConflictDoNothing();
}
