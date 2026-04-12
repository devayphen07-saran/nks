/**
 * Reconnection Handler — 5-step sequence when device comes back online.
 *
 * Step 1: Revocation check    GET /api/v1/auth/session-status
 *         └── revoked → performRemoteWipe() → powerSyncDb.disconnectAndClear()
 *
 * Step 2: Token refresh       POST /api/auth/refresh-token (via JWTManager)
 *         └── REFRESH_TOKEN_INVALID → logout
 *
 * Step 3: JWKS refresh        GET /api/v1/auth/mobile-jwks (via JWTManager.cacheJWKS)
 *
 * Step 4: Sync catch-up       powerSyncDb.triggerCatchUp() + waitForSyncComplete()
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
import { setUnauthenticated } from "../store/auth-slice";
import { JWTManager } from "../lib/jwt-manager";
import { powerSyncDb } from "../lib/powersync-db";
import { powerSyncConnector } from "../lib/powersync-connector";
import { fetchWithTimeout } from "../lib/fetch-with-timeout";
import { createLogger } from "../lib/logger";
import type { AppDispatch } from "../store";

const log = createLogger("ReconnectionHandler");

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Maximum time to wait for PowerSync to finish downloading (ms)
const SYNC_TIMEOUT_MS = 30_000;

// ─── Remote wipe ─────────────────────────────────────────────────────────────

async function performRemoteWipe(dispatch: AppDispatch): Promise<void> {
  log.warn("Remote wipe triggered — disconnecting and clearing PowerSync data");
  try {
    await powerSyncDb.disconnectAndClear();
    log.info("PowerSync data wiped");
  } catch (err) {
    log.error("PowerSync wipe failed:", err);
  }

  await JWTManager.clear();
  tokenManager.clear();
  await tokenManager.clearSession().catch(() => {});
  dispatch(setUnauthenticated());
  log.info("Session cleared after remote wipe");
}

// ─── Step 1: Revocation check ────────────────────────────────────────────────

async function checkSessionRevocation(): Promise<{ revoked: boolean; wipe: boolean }> {
  const accessToken = JWTManager.getRawAccessToken();
  if (!accessToken) return { revoked: false, wipe: false };

  try {
    const res = await fetchWithTimeout(
      `${API_BASE}/auth/session-status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
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

// ─── Step 4: Wait for sync complete ──────────────────────────────────────────

async function waitForSyncComplete(): Promise<void> {
  const abort = new AbortController();
  const timer = setTimeout(() => {
    abort.abort();
    log.warn("waitForSyncComplete timed out — continuing anyway");
  }, SYNC_TIMEOUT_MS);

  try {
    await powerSyncDb.waitForStatus(
      (s) => s.connected && !s.dataFlowStatus?.downloading,
      abort.signal,
    );
    log.info("Sync catch-up complete");
  } catch {
    // AbortError from timeout — already logged above
  } finally {
    clearTimeout(timer);
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
    try {
      const ok = await JWTManager.refreshFromServer();
      if (!ok) {
        log.warn("Token refresh returned false — tokens may be stale");
        // Continue anyway — access token might still be valid for JWKS + sync
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "REFRESH_TOKEN_INVALID") {
        log.warn("Refresh token invalid — logging out");
        await JWTManager.clear();
        tokenManager.clear();
        await tokenManager.clearSession().catch(() => {});
        dispatch(setUnauthenticated());
        return;
      }
      log.warn("Token refresh error (non-blocking):", err);
    }

    // ── Step 3: JWKS refresh ────────────────────────────────────────────────
    log.info("Step 3: refreshing JWKS cache...");
    const serverBase = API_BASE.replace(/\/api\/v\d+\/?$/, "");
    await JWTManager.cacheJWKS(serverBase).catch((err) => {
      log.warn("JWKS refresh failed (non-blocking):", err);
    });

    // ── Step 4: PowerSync catch-up ──────────────────────────────────────────
    log.info("Step 4: triggering PowerSync catch-up...");
    try {
      // Ensure connector is connected before triggering catch-up
      await powerSyncDb.connect(powerSyncConnector);
      await waitForSyncComplete();
    } catch (err) {
      log.warn("PowerSync catch-up failed (non-blocking):", err);
    }

    // ── Step 5: Restore Redux auth state ────────────────────────────────────
    log.info("Step 5: restoring auth state...");
    try {
      const envelope = await tokenManager.loadSession<AuthResponse>();
      if (envelope?.data) {
        const { setCredentials } = await import("../store/auth-slice");
        dispatch(setCredentials(envelope.data));
        log.info("Redux auth state restored");
      }
    } catch (err) {
      log.warn("Auth state restore failed (non-blocking):", err);
    }

    log.info("Reconnection sequence complete");
  } finally {
    _isHandling = false;
  }
}
