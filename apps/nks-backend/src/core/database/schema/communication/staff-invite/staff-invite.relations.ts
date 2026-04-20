import { relations } from 'drizzle-orm';
import { staffInvite } from './staff-invite.table';

export const staffInviteRelations = relations(staffInvite, () => ({}));
