import type { Db } from '../types.js';
import { staffInviteStatus } from '../../../src/core/database/schema/lookups/staff-invite-status/index.js';
import data from './data/staff-invite-statuses.js';

export async function seedStaffInviteStatuses(db: Db) {
  return db.insert(staffInviteStatus).values(data).onConflictDoNothing();
}
