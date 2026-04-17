/**
 * Reconnection Handler — 5-step sequence when device comes back online.
 *
 * Step 1: Revocation check    GET /api/v1/auth/session-status
 *         └── revoked → performRemoteWipe() → clearAllTables()
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
import { setCredentials, setUnauthenticated } from "../store/auth-slice";
import { JWTManager } from '../lib/auth/jwt-manager';
import { offlineSession } from '../lib/auth/offline-session';
import { clearAllTables } from "../lib/local-db";
import { runSync } from '../lib/sync/sync-engine';
import { fetchWithTimeout } from '../lib/utils/fetch-with-timeout';
import { createLogger } from '../lib/utils/logger';
import { refreshTokenAttempt } from '../lib/auth/refresh-token-attempt';
import type { AppDispatch } from "../store";

const log = createLogger("ReconnectionHandler");

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  dispatch(setUnauthenticated());
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

    if (revoked || wipe) {
      await performRemoteWipe(dispatch);
      return; // stop — user must re-login
    }

    // ── Step 2: Token refresh ───────────────────────────────────────────────
    log.info("Step 2: refreshing tokens...");
    const refreshResult = await refreshTokenAttempt();
    if (refreshResult.shouldLogout === true) {
      log.warn("Refresh token invalid — logging out");
      dispatch(setUnauthenticated());
      return;
    }
    if (!refreshResult.success) {
      log.warn("Token refresh returned false — tokens may be stale, continuing anyway");
    }

    // ── Step 3: JWKS refresh ────────────────────────────────────────────────
    log.info("Step 3: refreshing JWKS cache...");
    const serverBase = API_BASE.replace(/\/api\/v\d+\/?$/, "");
    await JWTManager.cacheJWKS(serverBase).catch((err) => {
      log.warn("JWKS refresh failed (non-blocking):", err);
    });

    // Load session once — used by both Step 4 (sync) and Step 5 (Redux restore)
    const envelope = await tokenManager.loadSession<AuthResponse>().catch(() => null);

    // ── Step 4: Sync catch-up ──────────────────────────────────────────────
    log.info("Step 4: running sync...");
    try {
      const storeGuuid = envelope?.data?.session?.defaultStore?.guuid;

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
