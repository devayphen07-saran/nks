import { pgTable, varchar, text, boolean } from 'drizzle-orm/pg-core';
import { baseEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';

/**
 * Staff Invite Status Lookup
 * Staff invitation states (Pending, Accepted, Rejected, Revoked, Expired)
 * Replaces hardcoded enum: staffInviteStatusEnum
 */
export const staffInviteStatus = pgTable('staff_invite_status', {
  ...baseEntity(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  description: text('description'),
  isTerminal: boolean('is_terminal').default(false),
  ...auditFields(() => users.id),
});

export type StaffInviteStatus = typeof staffInviteStatus.$inferSelect;
export type NewStaffInviteStatus = typeof staffInviteStatus.$inferInsert;
