/**
 * Proactive JWT refresh — refreshes the access token before it expires.
 *
 * Registers an AppState listener that fires when the app returns to foreground.
 * If the access token expires within the threshold (3 min), a refresh is triggered
 * immediately so API calls never land on an expired token.
 *
 * Self-managing: calling registerProactiveRefresh() a second time removes the
 * previous listener before registering a new one — prevents listener accumulation
 * across multiple OTP verifications or re-logins.
 *
 * Call unregisterProactiveRefresh() on logout to clean up.
 */

import { AppState, type AppStateStatus } from "react-native";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { JWTManager } from "./jwt-manager";
import { refreshTokenAttempt } from "./refresh-token-attempt";
import { isTokenExpired } from "./token-expiry";
import { createLogger } from "../utils/logger";

const log = createLogger("JWTRefresh");

// Refresh when access token expires within this window (same as JWTManager threshold)
const REFRESH_THRESHOLD_MS = 3 * 60 * 1000;

let _isRefreshing = false;
/** Tracks the active AppState subscription so repeated registrations don't stack. */
let _activeUnregister: (() => void) | null = null;
/** Callback to sync Redux after a successful proactive refresh. */
let _onSuccess: ((authResponse: AuthResponse) => void) | null = null;

function needsRefresh(): boolean {
  const raw = JWTManager.getRawAccessToken();
  if (!raw) return false;
  return isTokenExpired(raw, REFRESH_THRESHOLD_MS);
}

/**
 * Attempts a token refresh if the access token is near expiry.
 * Guards against concurrent refresh attempts.
 */
export async function tryProactiveRefresh(): Promise<void> {
  if (_isRefreshing) {
    log.debug("Refresh already in progress, skipping");
    return;
  }

  if (!needsRefresh()) {
    log.debug("Access token still fresh, no refresh needed");
    return;
  }

  _isRefreshing = true;
  log.info("Access token near expiry — refreshing proactively");

  try {
    const result = await refreshTokenAttempt();
    if (result.shouldLogout === true) {
      log.warn("Refresh token rejected — session expired");
      throw new Error("REFRESH_TOKEN_INVALID");
    }
    if (result.success) {
      log.info("Proactive refresh succeeded");
      if (_onSuccess) {
        try {
          const envelope = await tokenManager.loadSession<AuthResponse>();
          if (envelope?.data) {
            _onSuccess(envelope.data);
          }
        } catch (syncErr) {
          log.debug("Redux sync after proactive refresh failed:", syncErr);
        }
      }
    } else {
      log.warn("Proactive refresh returned false (network/server error)");
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "REFRESH_TOKEN_INVALID") {
      throw err;
    }
    log.error("Proactive refresh failed:", err);
  } finally {
    _isRefreshing = false;
  }
}

/**
 * Registers an AppState listener that triggers proactive refresh
 * whenever the app moves from background/inactive → active.
 *
 * Safe to call multiple times — removes the previous listener first.
 * Returns the unregister function (same as unregisterProactiveRefresh).
 */
export function registerProactiveRefresh(
  onSuccess?: (authResponse: AuthResponse) => void,
): () => void {
  _onSuccess = onSuccess ?? null;

  // Remove any existing listener before creating a new one
  if (_activeUnregister) {
    _activeUnregister();
  }

  let lastState: AppStateStatus = AppState.currentState;

  const subscription = AppState.addEventListener(
    "change",
    async (nextState: AppStateStatus) => {
      const comingToForeground =
        (lastState === "background" || lastState === "inactive") &&
        nextState === "active";

      lastState = nextState;

      if (comingToForeground) {
        log.info("App foregrounded — checking token freshness");
        try {
          await tryProactiveRefresh();
        } catch {
          // REFRESH_TOKEN_INVALID — app stays usable in offline mode
          // The next API call will hit 401 and the interceptor will logout
        }
      }
    },
  );

  _activeUnregister = () => {
    subscription.remove();
    _activeUnregister = null;
    log.info("Proactive refresh unregistered");
  };

  log.info("Proactive refresh registered");
  return _activeUnregister;
}

/**
 * Removes the active proactive refresh listener.
 * Call this on logout to prevent stale listeners.
 */
export function unregisterProactiveRefresh(): void {
  if (_activeUnregister) {
    _activeUnregister();
  }
}

/**
 * Resets module-level refresh state. Call on logout to prevent
 * stale flags from leaking across user sessions.
 */
export function resetRefreshState(): void {
  _isRefreshing = false;
  _onSuccess = null;
  if (_activeUnregister) {
    _activeUnregister();
  }
}
