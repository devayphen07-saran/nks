import { pgTable, bigint, integer, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './auth/users';

/**
 * Permissions Changelog — version-stamped record of per-user permission changes.
 *
 * Written when entity permissions on a role change and the role is fanned-out to
 * all users who hold it. The `version_number` matches the user's `permissionsVersion`
 * at the time of the write (numeric part of the "v<N>" string).
 *
 * Used by GET /auth/permissions-delta to return only the entries since the client's
 * last known version, rather than re-sending the full snapshot every reconnection.
 *
 * Created by migration 024_permissions_changelog.sql
 */
export const permissionsChangelog = pgTable(
  'permissions_changelog',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Numeric version at which this change was recorded.
    // Matches parseInt(user.permissionsVersion.replace('v', ''), 10).
    versionNumber: integer('version_number').notNull(),
    entityCode: varchar('entity_code', { length: 100 }).notNull(),
    // 'ADDED' — new entity permission row created for this user's role
    // 'REMOVED' — entity permission row deleted
    // 'MODIFIED' — flags changed
    operation: varchar('operation', { length: 10 }).notNull(),
    // Snapshot of the new permission flags. NULL for REMOVED.
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Primary query pattern: all changes for a user since version N
    index('permissions_changelog_user_version_idx').on(table.userFk, table.versionNumber),
  ],
);

export type PermissionsChangelogEntry = typeof permissionsChangelog.$inferSelect;
export type NewPermissionsChangelogEntry = typeof permissionsChangelog.$inferInsert;
