import { pgTable, bigint, unique } from 'drizzle-orm/pg-core';
import { junctionEntity } from '../base.entity';
import { staffInvite } from '../staff-invite';
import { permissions } from '../permissions';

/**
 * staff_invite_permission — junction table replacing permissionIds[] on staff_invite.
 *
 * The old integer[] array had no FK constraint — deleting a permission left stale
 * ghost IDs in the array with no way to detect or clean them up.
 *
 * This table enforces referential integrity:
 *   - permissionFk → permissions.id CASCADE:
 *     If a permission is removed from the system, it is automatically removed from
 *     all pending invites. On acceptInvite(), the resulting grant set reflects only
 *     permissions that still exist.
 *   - inviteFk → staff_invite.id CASCADE:
 *     When an invite is deleted / revoked, its permission rows are cleaned up.
 */
export const staffInvitePermission = pgTable(
  'staff_invite_permission',
  {
    ...junctionEntity(), // id, createdAt

    inviteFk: bigint('invite_fk', { mode: 'number' })
      .notNull()
      .references(() => staffInvite.id, { onDelete: 'cascade' }),

    permissionFk: bigint('permission_fk', { mode: 'number' })
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    // Prevent duplicate permission rows per invite
    unique('staff_invite_permission_unique_idx').on(
      table.inviteFk,
      table.permissionFk,
    ),
  ],
);

export type StaffInvitePermission = typeof staffInvitePermission.$inferSelect;
export type NewStaffInvitePermission =
  typeof staffInvitePermission.$inferInsert;
