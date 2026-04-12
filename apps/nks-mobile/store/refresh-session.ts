import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { setCredentials, logout as logoutAction } from "./auth-slice";
import { tokenMutex } from "../lib/token-mutex";
import { refreshTokenAttempt } from "../lib/refresh-token-attempt";
import { sanitizeError } from "../lib/log-sanitizer";
import type { AppDispatch } from "./index";

/**
 * Refresh the session token using the stored refresh token.
 * Called when:
 *   - Persisted session is stale (>15 min old) on app launch
 *   - 403 received (permissions may have changed)
 *
 * Uses shared refreshTokenAttempt() function to prevent duplication.
 * Wraps with tokenMutex to prevent concurrent refresh/logout race conditions.
 *
 * On success: updates Redux state with new session
 * On failure with shouldLogout=true: force logout
 * On failure with network error: keep cached session, user stays logged in
 */
export const refreshSession = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/refreshSession", async (_, { dispatch }) => {
  // ✅ CRITICAL FIX #3: Use mutex to prevent concurrent logout during refresh
  await tokenMutex.withRefreshLock(async () => {
    try {
      // Call the unified refresh function
      const result = await refreshTokenAttempt();

      if (result.success) {
        // Refresh succeeded — update Redux with new session
        const envelope = await tokenManager.loadSession<AuthResponse>();
        if (envelope?.data) {
          dispatch(setCredentials(envelope.data));
          console.log("[RefreshSession] Session refreshed successfully");
        }
      } else if (result.shouldLogout) {
        // Refresh token invalid/expired — must logout
        console.warn("[RefreshSession] Forcing logout:", result.error);
        tokenManager.clear();
        await tokenManager.clearSession();
        dispatch(logoutAction());
      } else {
        // Network error — keep cached session alive
        console.warn("[RefreshSession] Refresh failed (network issue):", result.error);
        // User stays logged in with cached session
      }
    } catch (error) {
      console.error("[RefreshSession] Unexpected error:", sanitizeError(error));
      // On unexpected errors, keep user logged in with cached session
    }
  });
});
