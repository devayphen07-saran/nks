/**
 * Unified token refresh logic
 * Called from both the refreshSession thunk and axios interceptor
 * Prevents duplication and ensures consistent behavior
 */

import { API, type AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { jwtDecode } from "jwt-decode";
import { offlineSession } from "./offline-session";
import { syncServerTime } from "../utils/server-time";
import { validateTokensBeforeRefresh } from "./token-expiry";
import { sanitizeError } from "../utils/log-sanitizer";
import { createLogger } from "../utils/logger";
import { JWTManager } from "./jwt-manager";
import { AxiosError } from "axios";

const log = createLogger("RefreshTokenAttempt");

export interface RefreshAttemptResult {
  success: boolean;
  newToken?: string;
  error?: string;
  shouldLogout?: boolean; // true if refresh token is invalid/expired
  permissionsChanged?: boolean; // true if server detected role changes since last login
}

/**
 * Attempts to refresh the session token using the stored refresh token.
 * Handles all necessary updates: in-memory token, SecureStore, offline session.
 *
 * @returns success: true if refresh succeeded
 * @returns newToken: the new session token (if success)
 * @returns shouldLogout: true if server rejected the refresh (401/403) - must logout
 */
export async function refreshTokenAttempt(): Promise<RefreshAttemptResult> {
  try {
    // Load current session
    const envelope = await tokenManager.loadSession<AuthResponse>();

    // Validate refresh token BEFORE attempting API call
    const validation = await validateTokensBeforeRefresh(envelope);

    if (!validation.canRefresh) {
      log.warn("[RefreshAttempt] Cannot refresh session", {
        error: validation.error,
        details: validation.details,
      });
      return {
        success: false,
        error: validation.error,
        shouldLogout: true, // Can't refresh = must logout
      };
    }

    const refreshTokenValue = validation.refreshToken;

    // Call refresh API
    const response = await API.post("/auth/refresh-token", {
      refreshToken: refreshTokenValue,
    });

    const result = response.data?.data;
    const newSessionToken = result?.auth?.sessionToken;

    if (!newSessionToken || !envelope?.data) {
      log.warn("[RefreshAttempt] Malformed refresh response");
      return {
        success: false,
        error: "Malformed response",
      };
    }

    tokenManager.set(newSessionToken);

    const updated: AuthResponse = {
      ...envelope.data,
      auth: {
        ...envelope.data.auth,
        sessionToken: newSessionToken,
        ...(result?.auth?.refreshToken ? { refreshToken: result.auth.refreshToken } : {}),
        ...(result?.auth?.expiresAt ? { expiresAt: result.auth.expiresAt } : {}),
        ...(result?.auth?.refreshExpiresAt ? { refreshExpiresAt: result.auth.refreshExpiresAt } : {}),
        ...(result?.auth?.accessToken ? { accessToken: result.auth.accessToken } : {}),
      },
      context: result?.context ?? envelope.data.context,
      offline: result?.offline !== undefined ? result.offline : envelope.data.offline,
    };

    await tokenManager.persistSession(updated);

    if (result?.auth?.accessToken && result?.offline?.token && result?.auth?.refreshToken) {
      await JWTManager.persistTokens({
        accessToken: result.auth.accessToken,
        offlineToken: result.offline.token,
        refreshToken: result.auth.refreshToken,
      }).catch((err) => {
        log.warn("[RefreshAttempt] JWTManager persistTokens failed:", sanitizeError(err));
      });
    }

    try {
      await syncServerTime();
    } catch (error) {
      log.debug(
        "[RefreshAttempt] Server time sync failed:",
        sanitizeError(error),
      );
    }

    // When permissions changed, decode the new offline JWT (which the server
    // already signed with the updated roles) and write those roles into the
    // offline session — no extra round-trip to /auth/permissions-delta needed.
    try {
      const session = await offlineSession.load();
      if (session) {
        const newOfflineToken = result?.offline?.token ?? undefined;

        if (result?.permissionsChanged && newOfflineToken) {
          try {
            const decoded = jwtDecode<{ roles?: string[] }>(newOfflineToken);
            const newRoles = decoded.roles ?? [];
            await offlineSession.updateRolesAndExtend(session, newRoles, newOfflineToken);
            log.info("[RefreshAttempt] Offline session roles updated from refreshed offline JWT");
          } catch (decodeErr) {
            log.warn("[RefreshAttempt] Failed to decode new offline JWT, marking roles stale:", sanitizeError(decodeErr));
            await offlineSession.extendValidity({ ...session, lastRoleSyncAt: 0 });
          }
        } else {
          await offlineSession.extendValidity(session);
        }
        log.info("[RefreshAttempt] Offline session validity extended");
      } else if (result?.offline?.token && envelope.data?.user?.guuid) {
        // No offline session exists — create one from the fresh refresh response.
        // This covers the upgrade path and any cold-start edge case where the
        // session was deleted (e.g. SecureStore eviction on low-memory Android).
        let roles: string[] = [];
        try {
          roles = jwtDecode<{ roles?: string[] }>(result.offline.token).roles ?? [];
        } catch { /* empty roles accepted */ }

        await offlineSession.create({
          userGuuid: envelope.data.user.guuid,
          storeGuuid: result?.context?.defaultStoreGuuid ?? envelope.data.context?.defaultStoreGuuid ?? null,
          storeName: '',
          roles,
          offlineToken: result.offline.token,
          signature: result.offline.sessionSignature,
          deviceId: result?.sync?.deviceId ?? envelope.data.sync?.deviceId ?? undefined,
        });
        log.info("[RefreshAttempt] Offline session created from refresh response");
      }
    } catch (error) {
      log.debug(
        "[RefreshAttempt] Offline session update failed:",
        sanitizeError(error),
      );
      // Non-critical — continue anyway
    }

    log.info("[RefreshAttempt] Token refreshed successfully");
    return {
      success: true,
      newToken: newSessionToken,
      permissionsChanged: result?.permissionsChanged ?? false,
    };
  } catch (error: unknown) {
    const axiosError = error as AxiosError | undefined;
    const status = axiosError?.response?.status;

    // Server explicitly rejected the refresh token (401/403) → must logout
    if (status === 401 || status === 403) {
      log.warn(
        "[RefreshAttempt] Refresh token rejected by server (401/403)",
      );
      return {
        success: false,
        error: "Refresh token expired",
        shouldLogout: true,
      };
    }

    // Network error / timeout / server down → don't logout, user stays logged in with cached session
    log.error("[RefreshAttempt] Refresh failed:", sanitizeError(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      shouldLogout: false, // Keep user logged in, they can retry
    };
  }
}
