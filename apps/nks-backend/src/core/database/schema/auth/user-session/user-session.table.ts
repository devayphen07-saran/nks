import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  bigint,
  boolean,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { sessionDeviceTypeEnum, authMethodEnum } from '../../enums';

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
    platform: varchar('platform', { length: 20 }), // ios | android | web (for consistency)
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

    // ✅ MODULE 2: Token Refresh Strategy
    // Refresh token is stored as SHA256 hash (never plaintext)
    refreshTokenHash: varchar('refresh_token_hash', { length: 64 }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),

    // Device fingerprint — HMAC-SHA256 of client IP (privacy-safe, server-keyed)
    // Stored alongside raw ipAddress so fingerprint checks don't expose the raw IP
    ipHash: varchar('ip_hash', { length: 64 }),

    // Role hash (SHA256) for detecting role changes between requests
    // If this differs from current role hash, roles have changed and session should be invalidated
    roleHash: varchar('role_hash', { length: 64 }),

    // Refresh Token Rotation (security)
    // When null: refresh token is still valid
    // When set: refresh token was revoked — revokedReason explains why
    refreshTokenRevokedAt: timestamp('refresh_token_revoked_at', {
      withTimezone: true,
    }),

    // Why this token was revoked:
    //   ROTATION          — normal token rotation (expected)
    //   TOKEN_REUSE       — stolen/replayed token detected
    //   LOGOUT            — user explicitly logged out
    //   PASSWORD_CHANGE   — password changed, all sessions invalidated
    //   ADMIN_FORCE_LOGOUT — admin terminated session
    revokedReason: varchar('revoked_reason', { length: 50 }),

    // True if this session issued a new refresh token to the client (rotation completed)
    // On next refresh, old session marked as rotated, new session created with new token
    isRefreshTokenRotated: boolean('is_refresh_token_rotated')
      .notNull()
      .default(false),
  },
  (table) => [
    index('user_session_user_idx').on(table.userId),
    index('user_session_token_idx').on(table.token),
    // Index for theft detection: find sessions with revoked tokens
    index('user_session_revoked_idx').on(table.userId, table.refreshTokenRevokedAt),
  ],
);

export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;
export type UpdateUserSession = Partial<Omit<NewUserSession, 'id'>>;
export type PublicUserSession = Omit<UserSession, 'token'>;
