// ============================================================================
// AUTH & SESSION CONFIGURATION
// ============================================================================

export const AUTH_CONSTANTS = {
  // Session Configuration
  // Note: JWT TTLs and algorithm live in auth.constants.ts (ACCESS_TOKEN_TTL_MS etc.)
  // and are signed with RS256 via JWTConfigService — do not duplicate them here.
  SESSION: {
    EXPIRY_DAYS: 30,
    EXPIRY_SECONDS: 60 * 60 * 24 * 30,
    UPDATE_AGE_SECONDS: 60 * 60 * 24, // BetterAuth compat: refresh if older than 1 day
    COOKIE_NAME: 'nks_session',
    COOKIE_SECURE: process.env['NODE_ENV'] === 'production',
    // SameSite strategy:
    //   'strict' — same-domain deployments (default, most secure)
    //   'lax'    — cross-site top-level navigations (OAuth callbacks, email links)
    //   'none'   — cross-domain API (forces Secure=true regardless of NODE_ENV)
    COOKIE_SAME_SITE: (process.env['CSRF_SAME_SITE'] ?? 'strict') as 'strict' | 'lax' | 'none',
    COOKIE_HTTP_ONLY: true,
    COOKIE_PATH: '/',
    MAX_PER_USER: 5,

    // Rolling session — opaque token rotation for cookie-based (web) sessions.
    // Every ROTATION_INTERVAL_SECONDS the nks_session cookie value is replaced
    // with a new random token and expiresAt is pushed forward EXPIRY_SECONDS.
    // This bounds the replay window: a stolen cookie is only usable until the
    // legitimate user's next request triggers rotation and invalidates it.
    // Bearer (mobile) sessions are exempt — they use the explicit refresh-token flow.
    ROTATION_INTERVAL_SECONDS: 60 * 60, // rotate every 1 hour
  },

  // Login Attempts & Lockout
  ACCOUNT_SECURITY: {
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    ACCOUNT_LOCKOUT_MINUTES: 15,
    ACCOUNT_LOCKOUT_MS: 15 * 60 * 1000,
  },

  // Device Tracking
  SUPPORTED_DEVICE_TYPES: ['IOS', 'ANDROID', 'WEB'] as const,

  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS_REGEX: /[!@#$%^&*]/,
  },
} as const;

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER_CONSTANTS = {
  PORT: 4000,
  HOST: 'localhost',
  API_BASE_PATH: '/api/v1',
  API_VERSION: '2026-03',
  REQUEST_TIMEOUT_MS: 30 * 1000,
} as const;

