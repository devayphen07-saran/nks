import {
  pgTable,
  varchar,
  text,
  timestamp,
  index,
  bigint,
  boolean,
  uuid,
} from 'drizzle-orm/pg-core';
import { betterAuthEntity } from '../../base.entity';
import { users } from '../../auth/users';
import { store } from '../../store/store';
import { sessionDeviceTypeEnum, authMethodEnum } from '../../enums';

/**
 * User Session Table — Token Rotation & Theft Detection
 *
 * DESIGN:
 * - On login: INSERT new session row per device
 * - On refresh: CREATE new session row (token rotation for security)
 *   + Mark old session refreshTokenRevokedAt = now
 *   + OLD sessions with refreshTokenRevokedAt older than 30 days are deleted via cleanup
 *
 * RESULT:
 * - Prevents row proliferation: max O(active_devices) rows per user, not O(refreshes)
 * - Preserves token rotation security (new token on each refresh)
 * - Maintains audit trail for 30 days (for theft detection investigation)
 * - Example: 10,000 users × 3 devices × 1 row = 30,000 rows (vs 14.4M)
 */
export const userSession = pgTable(
  'user_session',
  {
    ...betterAuthEntity(),

    // BetterAuth core
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    userFk: bigint('user_fk', { mode: 'number' })
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

    // JWT ID — the jti claim from the RS256 access token issued for this session.
    // Stored here so that on logout/revoke we can blocklist this specific JWT
    // without decoding the token string at revocation time.
    jti: uuid('jti'),

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

    // Rolling session: timestamp of the last opaque token rotation.
    // NULL for sessions created before rolling-session feature was deployed —
    // treated as createdAt for rotation threshold purposes.
    lastRotatedAt: timestamp('last_rotated_at', { withTimezone: true }),

    // Per-session CSRF secret — random 32-byte hex generated at session creation.
    // CSRF token = HMAC-SHA256(csrfSecret, CSRF_HMAC_SECRET).
    // Independent of the session token: even if the session token leaks, an
    // attacker cannot forge a CSRF token without also knowing csrfSecret.
    // Rotated on every rolling session rotation and on @RotateCsrf() routes.
    // NULL for sessions created before this feature — falls back to HMAC(token, secret).
    csrfSecret: varchar('csrf_secret', { length: 64 }),
  },
  (table) => [
    index('user_session_user_idx').on(table.userFk),
    index('user_session_token_idx').on(table.token),
    // Refresh token lookup — hit on every token refresh
    index('user_session_refresh_token_hash_idx').on(table.refreshTokenHash),
    // Active-session queries — hit on every auth check (findActive*, getActiveSessionCount)
    index('user_session_expires_at_idx').on(table.expiresAt),
    // Index for theft detection: find sessions with revoked tokens
    index('user_session_revoked_idx').on(table.userFk, table.refreshTokenRevokedAt),
  ],
);

export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;
export type UpdateUserSession = Partial<Omit<NewUserSession, 'id'>>;
export type PublicUserSession = Omit<UserSession, 'token'>;
