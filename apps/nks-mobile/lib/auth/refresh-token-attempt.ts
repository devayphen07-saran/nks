/**
 * Unified token refresh logic
 * Called from both the refreshSession thunk and axios interceptor
 * Prevents duplication and ensures consistent behavior
 */

import { API, type AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import {
  offlineSession,
  decodeOfflineTokenRoles,
  createOfflineSessionFromAuth,
} from "./offline-session";
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
    const newSessionToken = result?.auth?.bearerToken;

    if (!newSessionToken || !envelope?.data) {
      log.warn("[RefreshAttempt] Malformed refresh response");
      return {
        success: false,
        error: "Malformed response",
      };
    }

    tokenManager.set(newSessionToken, envelope.data.auth.sessionId);

    const updated: AuthResponse = {
      ...envelope.data,
      auth: {
        ...envelope.data.auth,
        bearerToken: newSessionToken,
        ...(result?.auth?.refreshToken ? { refreshToken: result.auth.refreshToken } : {}),
        ...(result?.auth?.sessionExpiresAt ? { sessionExpiresAt: result.auth.sessionExpiresAt } : {}),
        ...(result?.auth?.refreshTokenExpiresAt ? { refreshTokenExpiresAt: result.auth.refreshTokenExpiresAt } : {}),
      },
      context: result?.context ?? envelope.data.context,
      offline: result?.offline !== undefined ? result.offline : envelope.data.offline,
    };

    await tokenManager.persistSession(updated);

    if (result?.offline?.token && result?.auth?.refreshToken) {
      await JWTManager.persistTokens({
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

    // When permissions changed, decode the new offline JWT (server-signed with
    // the updated roles) and write those roles into the offline session — no
    // round-trip to /auth/permissions-delta needed.
    try {
      const session = await offlineSession.load();
      const newOfflineToken = result?.offline?.token ?? undefined;

      if (session && result?.permissionsChanged && newOfflineToken) {
        const newRoles = decodeOfflineTokenRoles(newOfflineToken);
        if (newRoles.length === 0) {
          // Decode failed (returned []) — mark roles stale so the next
          // online cycle reconciles them, and keep the session usable.
          log.warn("[RefreshAttempt] Decoded zero roles from offline JWT — marking roles stale");
          await offlineSession.extendValidity({ ...session, lastRoleSyncAt: 0 });
        } else {
          await offlineSession.updateRolesAndExtend(session, newRoles, newOfflineToken);
          log.info("[RefreshAttempt] Offline session roles updated from refreshed offline JWT");
        }
      } else if (session) {
        await offlineSession.extendValidity(session);
        log.info("[RefreshAttempt] Offline session validity extended");
      } else {
        // No offline session exists — rebuild from the merged refresh response.
        // Covers the upgrade path and cold-start edge cases where SecureStore
        // evicted the session (low-memory Android).
        const rebuilt = await createOfflineSessionFromAuth(updated);
        if (rebuilt) {
          log.info("[RefreshAttempt] Offline session created from refresh response");
        }
      }
    } catch (error) {
      log.warn(
        "[RefreshAttempt] Offline session update failed (non-critical):",
        sanitizeError(error),
      );
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
