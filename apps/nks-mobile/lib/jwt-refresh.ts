/**
 * Proactive JWT refresh — refreshes the access token before it expires.
 *
 * Registers an AppState listener that fires when the app returns to foreground.
 * If the access token expires within the threshold (3 min), a refresh is triggered
 * immediately so API calls never land on an expired token.
 *
 * Also exports a manual trigger for use in reconnection flows.
 *
 * Usage:
 *   const unregister = registerProactiveRefresh();
 *   // on cleanup / logout:
 *   unregister();
 */

import { AppState, type AppStateStatus } from "react-native";
import { jwtDecode } from "jwt-decode";
import { JWTManager } from "./jwt-manager";
import { createLogger } from "./logger";

const log = createLogger("JWTRefresh");

// Refresh when access token expires within this window
const REFRESH_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes

let _isRefreshing = false;

function getAccessTokenExpMs(): number | null {
  const raw = JWTManager.getRawAccessToken();
  if (!raw) return null;
  try {
    const decoded = jwtDecode<{ exp?: number }>(raw);
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function needsRefresh(): boolean {
  const expMs = getAccessTokenExpMs();
  if (!expMs) return false; // no token or undecodable — JWTManager handles null
  return Date.now() >= expMs - REFRESH_THRESHOLD_MS;
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
    const ok = await JWTManager.refreshFromServer();
    if (ok) {
      log.info("Proactive refresh succeeded");
    } else {
      log.warn("Proactive refresh returned false (network/server error)");
    }
  } catch (err: unknown) {
    // REFRESH_TOKEN_INVALID → tokens are dead, caller (auth store) handles logout
    if (err instanceof Error && err.message === "REFRESH_TOKEN_INVALID") {
      log.warn("Refresh token rejected — session expired");
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
 * Returns an unregister function — call it on logout or component unmount.
 */
export function registerProactiveRefresh(): () => void {
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

  log.info("Proactive refresh registered");

  return () => {
    subscription.remove();
    log.info("Proactive refresh unregistered");
  };
}
