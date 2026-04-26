import { bigint, boolean, pgTable, unique, varchar } from 'drizzle-orm/pg-core';
import { users } from './auth/users';
import { coreEntity, auditFields } from './base.entity';

export const userPreferences = pgTable(
  'user_preferences',
  {
    ...coreEntity(),

    userFk: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // UI / display preferences
    theme: varchar('theme', { length: 20 }).default('light'),
    timezone: varchar('timezone', { length: 50 }),
    notificationsEnabled: boolean('notifications_enabled')
      .default(true)
      .notNull(),

    // Audit: who created / modified / deleted this row
    ...auditFields(() => users.id),
  },
  (table) => [unique('user_preferences_user_unique').on(table.userFk)],
);

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
