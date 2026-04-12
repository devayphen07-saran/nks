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
  // Offline POS session
  OFFLINE_SESSION: "nks_offline_session",
  // Device fingerprint (platform:model:appVersion SHA-256)
  DEVICE_FINGERPRINT: "nks.device.fingerprint",
} as const;
