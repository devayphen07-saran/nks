import type { Db } from './types.js';
import { staffInviteStatus } from '../../src/core/database/schema/lookups/staff-invite-status';

const data = [
  { code: 'PENDING', label: 'Pending', description: 'Invitation sent, awaiting acceptance' },
  { code: 'ACCEPTED', label: 'Accepted', description: 'Invitation accepted, staff onboarded' },
  { code: 'REVOKED', label: 'Revoked', description: 'Invitation revoked by admin' },
  { code: 'EXPIRED', label: 'Expired', description: 'Invitation link expired' },
];

export async function seedStaffInviteStatuses(db: Db) {
  return db.insert(staffInviteStatus).values(data).onConflictDoNothing();
}
