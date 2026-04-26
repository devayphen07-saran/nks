import {
  pgTable,
  bigint,
  boolean,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { coreEntity, auditFields } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { roles } from '../../rbac/roles';
import { staffInviteStatus } from '../../lookups/staff-invite-status/staff-invite-status.table';

// Granted permissions live in staff_invite_permission (junction table).
// The old permissionIds integer[] array is removed — it had no FK constraint
// and silently accumulated stale IDs when permissions were deleted.

export const staffInvite = pgTable(
  'staff_invite',
  {
    ...coreEntity(),

    storeFk: bigint('store_fk', { mode: 'number' })
      .notNull()
      .references(() => store.id, { onDelete: 'cascade' }),
    invitedByFk: bigint('invited_by_fk', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // inviteeEmail — stored for display/notification (always present).
    // inviteeFk   — set at creation if the invitee already has an account;
    //               backfilled at accept time for first-time registrants.
    // Accept validation:
    //   inviteeFk IS NOT NULL → must match authenticatedUser.id (hard check)
    //   inviteeFk IS NULL     → compare inviteeEmail case-insensitively, then backfill inviteeFk
    inviteeEmail: varchar('invitee_email', { length: 255 }).notNull(),
    inviteeFk: bigint('invitee_fk', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    roleFk: bigint('role_fk', { mode: 'number' })
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),

    // Invite token — UUID without dashes (32 chars)
    token: varchar('token', { length: 64 }).notNull().unique(),
    // NORMALIZED: Status is now an FK to staff_invite_status lookup table (was enum)
    statusFk: bigint('status_fk', { mode: 'number' })
      .notNull()
      .references(() => staffInviteStatus.id, { onDelete: 'restrict' }),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedByFk: bigint('accepted_by_fk', { mode: 'number' }).references(
      () => users.id,
      { onDelete: 'set null' },
    ),

    // Mirrors staff_invite_status.isPending for the current status row.
    // Set to true on creation (all invites start pending).
    // Set to false on any status transition (accept, reject, revoke, expire).
    // Used in the partial unique index so the constraint is ID-independent —
    // PostgreSQL partial index predicates cannot reference other tables.
    isPending: boolean('is_pending').notNull().default(true),

    ...auditFields(() => users.id),
  },
  (table) => [
    // Prevent duplicate pending invites for the same store + email.
    // is_pending = false on all terminal statuses (ACCEPTED, REJECTED, REVOKED, EXPIRED)
    // so re-inviting after a previous invite was resolved is allowed.
    uniqueIndex('staff_invite_pending_unique_idx')
      .on(table.storeFk, table.inviteeEmail)
      .where(sql`is_pending = true AND deleted_at IS NULL`),
  ],
);

export type StaffInvite = typeof staffInvite.$inferSelect;
export type NewStaffInvite = typeof staffInvite.$inferInsert;
export type UpdateStaffInvite = Partial<Omit<NewStaffInvite, 'id'>>;
