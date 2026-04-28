/**
 * Reconnection Handler — 5-step sequence when device comes back online.
 *
 * Step 1: Revocation check    GET /api/v1/auth/session-status
 *         └── wipe:true   → performRemoteWipe() → clearAllTables() (token theft)
 *         └── revoked:true → clear credentials only, keep local DB (remote logout)
 *
 * Step 2: Token refresh       POST /api/auth/refresh-token (via JWTManager)
 *         └── REFRESH_TOKEN_INVALID → logout
 *
 * Step 3: JWKS refresh        GET /api/v1/auth/mobile-jwks (via JWTManager.cacheJWKS)
 *
 * Step 4: Sync catch-up       runSync(storeGuuid) — pull changes, push mutations
 *
 * Step 5: Redux state update  dispatch(setCredentials) to keep React tree fresh
 *
 * Usage:
 *   import { handleReconnection } from '@/services/reconnection-handler';
 *   // wire into network state listener (Step 9.4)
 *   await handleReconnection(store.dispatch);
 */

import { tokenManager } from "@nks/mobile-utils";
import type { AuthResponse } from "@nks/api-manager";
import { setCredentials, logout } from "../store/auth-slice";
import { JWTManager } from '../lib/auth/jwt-manager';
import { offlineSession } from '../lib/auth/offline-session';
import { clearAllTables } from "../lib/local-db";
import { runSync } from '../lib/sync/sync-engine';
import { fetchWithTimeout } from '../lib/utils/fetch-with-timeout';
import { createLogger } from '../lib/utils/logger';
import { refreshTokenAttempt } from '../lib/auth/refresh-token-attempt';
import { getServerBaseUrl } from '../lib/utils/api-base-url';
import type { AppDispatch } from "../store";

const log = createLogger("ReconnectionHandler");

const API_BASE = `${getServerBaseUrl()}/api/v1`;

// ─── Remote wipe ─────────────────────────────────────────────────────────────

async function performRemoteWipe(dispatch: AppDispatch): Promise<void> {
  log.warn("Remote wipe triggered — clearing local data");

  try {
    await clearAllTables();
    log.info("Local database wiped");
  } catch (err) {
    log.error("Database wipe failed (non-blocking):", err);
  }

  await JWTManager.clear();
  tokenManager.clear();
  await tokenManager.clearSession().catch(() => {});
  await offlineSession.clear().catch(() => {});
  dispatch(logout());
  log.info("Session cleared after remote wipe");
}

// ─── Step 1: Revocation check ────────────────────────────────────────────────

async function checkSessionRevocation(): Promise<{ revoked: boolean; wipe: boolean }> {
  // Use the opaque BetterAuth session token (not the JWT access token).
  // Backend GET /auth/session-status queries user_session.token which stores
  // the opaque session token, not the JWT.
  const sessionToken = tokenManager.get();
  if (!sessionToken) return { revoked: false, wipe: false };

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/auth/session-status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      },
      8_000,
    );

    if (!res.ok) {
      log.warn(`session-status check failed: HTTP ${res.status} — skipping`);
      return { revoked: false, wipe: false };
    }

    const body = await res.json();
    const data = body?.data ?? body;
    return {
      revoked: data?.revoked === true,
      wipe: data?.wipe === true,
    };
  } catch (err) {
    log.warn("session-status check error (non-blocking):", err);
    return { revoked: false, wipe: false };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

let _isHandling = false;

/**
 * Run the full reconnection sequence.
 * Guards against concurrent runs — safe to call multiple times.
 *
 * @param dispatch Redux dispatch from the store
 */
export async function handleReconnection(dispatch: AppDispatch): Promise<void> {
  if (_isHandling) {
    log.debug("Reconnection already in progress — skipping");
    return;
  }

  _isHandling = true;
  log.info("Reconnection sequence started");

  try {
    // ── Step 1: Revocation check ────────────────────────────────────────────
    log.info("Step 1: checking session revocation...");
    const { revoked, wipe } = await checkSessionRevocation();

    if (wipe) {
      // Token theft detected on the backend — all sessions nuked, destroy local data.
      log.warn("Step 1: remote wipe triggered (token theft)");
      await performRemoteWipe(dispatch);
      return;
    }

    if (revoked) {
      // Normal remote logout (e.g. user signed out from web/admin panel).
      // Clear session credentials only — keep local POS data so a re-login on
      // the same device can pick up where it left off.
      log.warn("Step 1: session revoked (remote logout) — clearing credentials only");
      tokenManager.clear();
      await tokenManager.clearSession().catch(() => {});
      await JWTManager.clear();
      await offlineSession.clear().catch(() => {});
      dispatch(logout());
      return;
    }

    // ── Step 2: Token refresh ───────────────────────────────────────────────
    log.info("Step 2: refreshing tokens...");
    const refreshResult = await refreshTokenAttempt();
    if (refreshResult.shouldLogout === true) {
      log.warn("Refresh token invalid — logging out");
      dispatch(logout());
      return;
    }
    if (!refreshResult.success) {
      log.warn("Token refresh returned false — tokens may be stale, continuing anyway");
    }

    // ── Step 3: JWKS refresh ────────────────────────────────────────────────
    log.info("Step 3: refreshing JWKS cache...");
    await JWTManager.cacheJWKS(getServerBaseUrl()).catch((err) => {
      log.warn("JWKS refresh failed (non-blocking):", err);
    });

    // Load session once — used by both Step 4 (sync) and Step 5 (Redux restore)
    const envelope = await tokenManager.loadSession<AuthResponse>().catch(() => null);

    // ── Step 4: Sync catch-up ──────────────────────────────────────────────
    log.info("Step 4: running sync...");
    try {
      const storeGuuid = envelope?.data?.context?.defaultStoreGuuid;

      if (storeGuuid) {
        await runSync(storeGuuid);
      } else {
        log.warn("Step 4: No store GUUID — skipping sync");
      }
    } catch (err) {
      log.warn("Step 4: Sync failed (non-blocking):", err);
    }

    // ── Step 5: Restore Redux auth state ────────────────────────────────────
    log.info("Step 5: restoring auth state...");
    if (envelope?.data) {
      dispatch(setCredentials(envelope.data));
      log.info("Redux auth state restored");
    }

    log.info("Reconnection sequence complete");
  } finally {
    _isHandling = false;
  }
}
