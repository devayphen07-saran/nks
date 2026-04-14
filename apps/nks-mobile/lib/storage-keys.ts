/**
 * Centralized SecureStore key constants.
 * All SecureStore keys are defined here to prevent duplication
 * and ensure key-string consistency across modules.
 */
export const STORAGE_KEYS = {
  // Server time synchronization
  CLOCK_OFFSET: "nks_clock_offset",
  CLOCK_SYNC_TIME: "nks_clock_sync_time",
  // Offline POS session
  OFFLINE_SESSION: "nks_offline_session",
  // Device fingerprint (platform:model:appVersion SHA-256)
  DEVICE_FINGERPRINT: "nks.device.fingerprint",
  // JWT tokens (access, offline window, refresh)
  JWT_ACCESS_TOKEN: "auth.jwt.access",
  JWT_OFFLINE_TOKEN: "auth.jwt.offline",
  JWT_REFRESH_TOKEN: "auth.jwt.refresh",
  // JWKS public key cache
  JWKS_CACHE: "auth.jwks.cache",
  JWKS_CACHED_AT: "auth.jwks.cached_at",
  JWKS_KID: "auth.jwks.kid",
} as const;
