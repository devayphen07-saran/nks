/**
 * Centralized SecureStore key constants.
 * All SecureStore keys are defined here to prevent duplication
 * and ensure key-string consistency across modules.
 */
export const STORAGE_KEYS = {
  // Auth session blob
  SESSION: "nks_session_auth",
  // Server time synchronization
  CLOCK_OFFSET: "nks_clock_offset",
  CLOCK_SYNC_TIME: "nks_clock_sync_time",
  // JWKS public key cache
  JWKS_PUBLIC_KEY: "nks_jwks_public_key",
  JWKS_CACHE_TIME: "nks_jwks_cache_time",
  JWKS_KID: "nks_jwks_key_id",
  // Offline POS session
  OFFLINE_SESSION: "nks_offline_session",
} as const;
