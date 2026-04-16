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

/** Role code for store owners — used for default store resolution. */
export const SYSTEM_ROLE_STORE_OWNER = 'STORE_OWNER' as const;

/** Throttle window for updating lastActiveAt (ms) — avoids a DB write on every request. */
export const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;
