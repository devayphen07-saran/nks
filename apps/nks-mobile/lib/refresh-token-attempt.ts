/**
 * Unified token refresh logic
 * Called from both the refreshSession thunk and axios interceptor
 * Prevents duplication and ensures consistent behavior
 */

import { API, type AuthResponse, type UserRoleEntry } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { offlineSession } from "./offline-session";
import { syncServerTime } from "./server-time";
import { validateTokensBeforeRefresh } from "./token-expiry";
import { sanitizeError } from "./log-sanitizer";
import { createLogger } from "./logger";
import { JWTManager } from "./jwt-manager";
import { AxiosError } from "axios";

const log = createLogger("RefreshTokenAttempt");

export interface RefreshAttemptResult {
  success: boolean;
  newToken?: string;
  error?: string;
  shouldLogout?: boolean; // true if refresh token is invalid/expired
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
    const newSessionToken = result?.sessionToken;

    if (!newSessionToken || !envelope?.data) {
      log.warn("[RefreshAttempt] Malformed refresh response");
      return {
        success: false,
        error: "Malformed response",
      };
    }

    // ✅ Update in-memory token
    tokenManager.set(newSessionToken);

    // ✅ Update SecureStore session with new tokens
    const updated: AuthResponse = {
      ...envelope.data,
      session: {
        ...envelope.data.session,
        sessionToken: newSessionToken,
        ...(result?.refreshToken ? { refreshToken: result.refreshToken } : {}),
        ...(result?.expiresAt ? { expiresAt: result.expiresAt } : {}),
        ...(result?.refreshExpiresAt
          ? { refreshExpiresAt: result.refreshExpiresAt }
          : {}),
      },
      ...(result?.offlineToken ? { offlineToken: result.offlineToken } : {}),
    };

    await tokenManager.persistSession(updated);

    // ✅ Sync JWTManager dual tokens after refresh
    if (result?.jwtToken && result?.offlineToken && result?.refreshToken) {
      await JWTManager.persistTokens({
        accessToken: result.jwtToken,
        offlineToken: result.offlineToken,
        refreshToken: result.refreshToken,
      }).catch((err) => {
        log.debug("[RefreshAttempt] JWTManager sync failed (non-critical):", sanitizeError(err));
      });
    }

    // ✅ Sync server time (non-critical)
    try {
      await syncServerTime();
    } catch (error) {
      log.debug(
        "[RefreshAttempt] Server time sync failed:",
        sanitizeError(error),
      );
    }

    // ✅ Update offline session with new role data and extended validity
    try {
      const session = await offlineSession.load();
      if (session) {
        const newRoles = updated.access?.roles;

        if (newRoles && newRoles.length > 0) {
          // Update with new roles and extend validity
          const roleCodes = newRoles.map((r: UserRoleEntry) => r.roleCode);
          await offlineSession.updateRolesAndExtend(
            session,
            roleCodes,
            result?.offlineToken,
          );
          log.info(
            "[RefreshAttempt] Offline session roles updated and validity extended",
          );
        } else {
          // No role data, just extend validity
          await offlineSession.extendValidity(session);
          log.info("[RefreshAttempt] Offline session validity extended");
        }
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
