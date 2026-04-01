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

    // User roles embedded in the session token for faster authorization checks
    userRoles: text('user_roles'), // JSON stringified array of role objects
    primaryRole: varchar('primary_role', { length: 50 }), // Primary role code (SUPER_ADMIN, STORE_OWNER, CASHIER, etc.)

    // ✅ MODULE 2: Token Refresh Strategy
    // Refresh token is stored as SHA256 hash (never plaintext)
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),

    // Note: JWT token and role hash are now managed in application memory
    // via the AuthService instead of persisted to the database
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
