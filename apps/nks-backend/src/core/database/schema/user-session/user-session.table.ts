import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  bigint,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../base.entity';
import { users } from '../users';
import { store } from '../store';
import { sessionDeviceTypeEnum, authMethodEnum } from '../enums';

export const userSession = pgTable(
  'user_session',
  {
    ...betterAuthEntity(),

    // BetterAuth core
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    userId: bigint('user_fk', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Additional device context
    deviceId: varchar('device_id', { length: 100 }),
    deviceName: varchar('device_name', { length: 100 }),
    deviceType: sessionDeviceTypeEnum('device_type'), // IOS | ANDROID | WEB
    appVersion: varchar('app_version', { length: 20 }),
    loginMethod: authMethodEnum('login_method'),

    // activeStoreFk — the store the user selected after login.
    // Avoids a per-request DB lookup to validate that the caller belongs to the store
    // they claim in each API request. Set on store selection, cleared on logout.
    // NULL for personal-account sessions (CUSTOMER role, no store).
    activeStoreFk: bigint('active_store_fk', { mode: 'number' }).references(
      () => store.id,
      { onDelete: 'set null' },
    ),
  },
  (table) => [
    index('user_session_user_idx').on(table.userId),
    index('user_session_token_idx').on(table.token),
  ],
);

export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;
export type UpdateUserSession = Partial<Omit<NewUserSession, 'id'>>;
export type PublicUserSession = Omit<UserSession, 'token'>;
