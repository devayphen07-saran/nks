/**
 * Server Time Synchronization
 * Calls POST /auth/sync-time to calculate device clock offset.
 * Detects excessive device clock drift and warns if it exceeds 30 seconds.
 * Offset is stored in SecureStore and used for token expiry validation.
 */

import { API } from "@nks/api-manager";
import { saveSecureItem, getSecureItem } from "@nks/mobile-utils";
import { MAX_CLOCK_DRIFT_SECONDS } from "@nks/utils";
import { STORAGE_KEYS } from "./storage-keys";
import { createLogger } from "./logger";

const log = createLogger("ServerTime");

/** Cached in-memory so we don't hit SecureStore on every validation */
let cachedOffsetSeconds: number | null = null;
let lastSyncTimeSeconds: number | null = null;
let isInitialized = false;

/**
 * Initialize server time from SecureStore.
 * Call at app startup to restore the clock offset before any token expiry checks.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initServerTime(): Promise<void> {
  return initializeFromStorage();
}

/**
 * Reset all server time state. Call on logout so the next user session
 * starts with a clean clock offset rather than inheriting a stale one.
 */
export function resetServerTime(): void {
  cachedOffsetSeconds = null;
  lastSyncTimeSeconds = null;
  isInitialized = false;
}

async function initializeFromStorage(): Promise<void> {
  if (isInitialized) return;

  try {
    const offsetStr = await getSecureItem(STORAGE_KEYS.CLOCK_OFFSET);
    const syncTimeStr = await getSecureItem(STORAGE_KEYS.CLOCK_SYNC_TIME);

    if (offsetStr) cachedOffsetSeconds = parseInt(offsetStr, 10);
    if (syncTimeStr) lastSyncTimeSeconds = parseInt(syncTimeStr, 10);

    if (cachedOffsetSeconds !== null || lastSyncTimeSeconds !== null) {
      log.info(
        `Initialized from storage: offset=${cachedOffsetSeconds}s, lastSync=${lastSyncTimeSeconds ? new Date(lastSyncTimeSeconds * 1000).toISOString() : "never"}`,
      );
    }
  } catch (error) {
    log.debug("Failed to initialize from storage:", error);
  }

  isInitialized = true;
}

/**
 * Calls the server sync-time endpoint and persists the offset.
 * Detects device time drift and warns if excessive (> 30 seconds).
 * Call this on login and on every successful token refresh.
 */
export async function syncServerTime(): Promise<{
  offset: number;
  drift?: number;
  isAcceptable: boolean;
}> {
  try {
    await initializeFromStorage();

    const deviceTime = Math.floor(Date.now() / 1000);
    const response = await API.post("/auth/sync-time", { deviceTime });
    const offset: number = response.data?.data?.offset ?? 0;

    let drift = 0;
    let isAcceptable = true;

    if (lastSyncTimeSeconds !== null) {
      const timeSinceLast = deviceTime - lastSyncTimeSeconds;
      const expectedOffset = cachedOffsetSeconds ?? 0;
      drift = Math.abs(offset - expectedOffset);

      if (timeSinceLast > 0) {
        log.debug(
          `${timeSinceLast}s since last sync, offset changed by ${drift}s`,
        );
      }

      if (drift > MAX_CLOCK_DRIFT_SECONDS) {
        log.warn(
          `DRIFT DETECTED: Offset changed by ${drift}s (was ${expectedOffset}s, now ${offset}s). ` +
            `Device time may have been adjusted. Threshold: ${MAX_CLOCK_DRIFT_SECONDS}s.`,
        );
        isAcceptable = false;
      }
    }

    cachedOffsetSeconds = offset;
    lastSyncTimeSeconds = deviceTime;

    await saveSecureItem(STORAGE_KEYS.CLOCK_OFFSET, String(offset));
    await saveSecureItem(STORAGE_KEYS.CLOCK_SYNC_TIME, String(deviceTime));

    log.info(`Synced. Offset: ${offset}s, Drift: ${drift}s, Acceptable: ${isAcceptable}`);

    return { offset, drift, isAcceptable };
  } catch (error) {
    log.warn("Sync failed, using cached offset:", error);
    return { offset: cachedOffsetSeconds ?? 0, isAcceptable: true };
  }
}

/**
 * Returns the stored clock offset in seconds (serverTime - deviceTime).
 * Positive = device is behind server. Negative = device is ahead.
 * Initializes from SecureStore on first call.
 */
async function getClockOffsetSeconds(): Promise<number> {
  await initializeFromStorage();
  return cachedOffsetSeconds ?? 0;
}

/**
 * Returns current time adjusted for server clock offset (in milliseconds).
 * Use this instead of Date.now() for token expiry checks.
 */
export async function getServerAdjustedNow(): Promise<number> {
  const offsetSeconds = await getClockOffsetSeconds();
  return Date.now() + offsetSeconds * 1000;
}
