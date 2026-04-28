/**
 * Injection token for the BetterAuth instance.
 */
export const BETTER_AUTH_TOKEN = Symbol('BETTER_AUTH');

// ── JWT Constants (single source of truth) ────────────────────────────────────

/** JWT audience claim — must match between issuance and verification. */
export const JWT_AUDIENCE = 'nks-app' as const;

/** Default offline JWT TTL in days. */
export const OFFLINE_JWT_TTL_DAYS = 3;

/** Default offline JWT expiration string for jsonwebtoken. */
export const OFFLINE_JWT_EXPIRATION = `${OFFLINE_JWT_TTL_DAYS}d` as const;

// ── Token / Session TTLs ──────────────────────────────────────────────────────
// Centralised so issuance, verification, JTI blocklist, and revocation logic
// all read the same source. Do not inline `15 * 60 * 1000` again — import the
// constant. Changing a TTL requires a code review event anyway, so these are
// intentionally static (not ConfigService-driven).

/** Access-token TTL (ms) — used for JWT expiry, session row `access_token_expires_at`, and JTI blocklist pruning. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Refresh-token TTL (ms) — used for opaque refresh token expiry and session row `refresh_token_expires_at`. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** OTP code TTL (ms) — how long a sent OTP remains valid for verification. */
export const OTP_EXPIRY_MS = 15 * 60 * 1000;

/** Retention window for revoked session rows (days) — purged by the cleanup scheduler. */
export const REVOKED_SESSION_RETENTION_DAYS = 30;

/** Maximum OTP verification attempts before the record is locked. */
export const OTP_MAX_ATTEMPTS = 5;
