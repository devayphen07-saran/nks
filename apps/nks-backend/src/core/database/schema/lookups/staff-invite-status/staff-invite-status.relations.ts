import { relations } from 'drizzle-orm';
import { staffInviteStatus } from './staff-invite-status.table';

export const staffInviteStatusRelations = relations(staffInviteStatus, () => ({}));
