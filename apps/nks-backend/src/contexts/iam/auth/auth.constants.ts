/**
 * Injection token for the BetterAuth instance.
 */
export const BETTER_AUTH_TOKEN = Symbol('BETTER_AUTH');

// ── JWT Constants (single source of truth) ────────────────────────────────────

/** JWT audience claim — must match between issuance and verification. */
export const JWT_AUDIENCE = 'nks-app' as const;

// ── Token / Session TTLs ──────────────────────────────────────────────────────
// Centralised so issuance, verification, and revocation logic all read the same
// source. Do not inline `15 * 60 * 1000` again — import the constant.
// Changing a TTL requires a code review event anyway, so these are
// intentionally static (not ConfigService-driven).

/** Access-token TTL (ms) — used for JWT expiry and session row `access_token_expires_at`. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

/** Refresh-token TTL (ms) — used for opaque refresh token expiry and session row `refresh_token_expires_at`. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Offline-token TTL (ms) — RS256 JWT issued to mobile for 3-day offline POS window. */
export const OFFLINE_TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/** OTP code TTL (ms) — how long a sent OTP remains valid for verification. */
export const OTP_EXPIRY_MS = 15 * 60 * 1000;

/** Retention window for revoked session rows (days) — purged by the cleanup scheduler. */
export const REVOKED_SESSION_RETENTION_DAYS = 30;

/** Maximum OTP verification attempts before the record is locked. */
export const OTP_MAX_ATTEMPTS = 3;

/**
 * Minimum interval between consecutive verify attempts on the same identifier.
 * Caps automated attackers to ~40 attempts/min/phone without the complexity of
 * an exponential backoff curve. Doesn't bother humans (>1.5s to type next OTP).
 */
export const OTP_MIN_VERIFY_INTERVAL_MS = 1500;

/**
 * Maximum accepted length of a session token / refresh token in incoming requests.
 *
 * Real session tokens are 64 hex chars; refresh tokens are base64url(32 bytes) ≈ 43 chars.
 * The cap exists to short-circuit DoS via arbitrarily large inputs before we hash them,
 * not as a correctness check — anything below the cap is still validated downstream.
 * 512 leaves headroom for future token format changes without a code edit.
 */
export const MAX_SESSION_TOKEN_LENGTH = 512;

/**
 * Minimum plausible length of a session token. Below this we reject as a probe
 * without touching the DB.
 */
export const MIN_SESSION_TOKEN_LENGTH = 32;

// ── Refresh-flow rate limits ──────────────────────────────────────────────────
// Two-tier defence on /auth/refresh-token:
//   1. Guard-level per-token cap (10 / 15 min) — keyed on sha256(token).
//   2. Service-level per-user cap (this constant) — keyed on session.userId
//      after the SELECT FOR UPDATE has identified the user. Caps the blast
//      radius of a multi-token compromise (N stolen tokens × per-token cap)
//      without knowing the user pre-validation.
// Window is fixed to match the guard so the two limits compose intuitively.

/** Max refresh attempts per user per REFRESH_RATE_LIMIT_WINDOW_MS. */
export const REFRESH_RATE_LIMIT_PER_USER = 60;

/** Sliding-window length for REFRESH_RATE_LIMIT_PER_USER. */
export const REFRESH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
