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

/** Cached in-memory so we don't hit SecureStore on every validation */
let cachedOffsetSeconds: number | null = null;
let lastSyncTimeSeconds: number | null = null;
let isInitialized = false;

/**
 * Initialize server time from SecureStore.
 * Called on app startup to restore clock offset.
 */
async function initializeFromStorage(): Promise<void> {
  if (isInitialized) return;

  try {
    const offsetStr = await getSecureItem(STORAGE_KEYS.CLOCK_OFFSET);
    const syncTimeStr = await getSecureItem(STORAGE_KEYS.CLOCK_SYNC_TIME);

    if (offsetStr) cachedOffsetSeconds = parseInt(offsetStr, 10);
    if (syncTimeStr) lastSyncTimeSeconds = parseInt(syncTimeStr, 10);

    if (cachedOffsetSeconds !== null || lastSyncTimeSeconds !== null) {
      console.log(
        `[ServerTime] Initialized from storage: offset=${cachedOffsetSeconds}s, lastSync=${lastSyncTimeSeconds ? new Date(lastSyncTimeSeconds * 1000).toISOString() : "never"}`,
      );
    }
  } catch (error) {
    console.debug("[ServerTime] Failed to initialize from storage:", error);
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
        console.debug(
          `[ServerTime] ${timeSinceLast}s since last sync, offset changed by ${drift}s`,
        );
      }

      if (drift > MAX_CLOCK_DRIFT_SECONDS) {
        console.warn(
          `[ServerTime] DRIFT DETECTED: Offset changed by ${drift}s (was ${expectedOffset}s, now ${offset}s). ` +
            `Device time may have been adjusted. Threshold: ${MAX_CLOCK_DRIFT_SECONDS}s.`,
        );
        isAcceptable = false;
      }
    }

    cachedOffsetSeconds = offset;
    lastSyncTimeSeconds = deviceTime;

    await saveSecureItem(STORAGE_KEYS.CLOCK_OFFSET, String(offset));
    await saveSecureItem(STORAGE_KEYS.CLOCK_SYNC_TIME, String(deviceTime));

    console.log(
      `[ServerTime] Synced. Offset: ${offset}s, Drift: ${drift}s, Acceptable: ${isAcceptable}`,
    );

    return { offset, drift, isAcceptable };
  } catch (error) {
    console.warn("[ServerTime] Sync failed, using cached offset:", error);
    return { offset: cachedOffsetSeconds ?? 0, isAcceptable: true };
  }
}

/**
 * Returns the stored clock offset in seconds (serverTime - deviceTime).
 * Positive = device is behind server. Negative = device is ahead.
 * Initializes from SecureStore on first call.
 */
export async function getClockOffsetSeconds(): Promise<number> {
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
