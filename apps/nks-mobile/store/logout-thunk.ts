import { createAsyncThunk } from "@reduxjs/toolkit";
import { signOut } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { logout as logoutAction } from "./auth-slice";
import { tokenMutex } from "../lib/token-mutex";
import { offlineSession } from "../lib/offline-session";
import { sanitizeError } from "../lib/log-sanitizer";
import { JWTManager } from "../lib/jwt-manager";
import { resetRateLimiters } from "../lib/rate-limiter";
import { resetRefreshState } from "../lib/jwt-refresh";
import { resetInterceptorState } from "../lib/axios-interceptors";
import { resetSyncState } from "../lib/sync-engine";
import { DeviceManager } from "../lib/device-manager";
import { createLogger } from "../lib/logger";
import { clearAllTables } from "../lib/local-db";
import { deleteDbKey } from "../lib/db-key";
import { IS_SHARED_DEVICE } from "../lib/device-config";
import type { AppDispatch } from "./index";

const log = createLogger("Logout");

export const logoutThunk = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/logout", async (_, { dispatch }) => {
  // ✅ CRITICAL FIX #3: Use mutex to prevent concurrent refresh during logout
  await tokenMutex.withClearLock(async () => {
    try {
      // Call sign-out BEFORE clearing the token so the Authorization header is
      // present and BetterAuth can invalidate the server-side session.
      try {
        await dispatch(signOut({}));
      } catch (error) {
        log.error("Sign-out API failed:", sanitizeError(error));
      }

      tokenManager.clear();
      await tokenManager.clearSession();
      await offlineSession.clear();
      await JWTManager.clear();
      await DeviceManager.clear();
      resetRefreshState();
      resetInterceptorState();
      resetSyncState();

      // Clear all synced data from local database
      await clearAllTables();

      // For shared devices, also delete the encryption key so next user cannot access cached data
      if (IS_SHARED_DEVICE) {
        try {
          await deleteDbKey();
        } catch (err) {
          log.error("Failed to delete DB key on shared device:", err);
        }
      }

      // Reset OTP rate limiters so a fresh login session starts clean
      resetRateLimiters();
      dispatch(logoutAction());
      log.info("Session and offline data cleared successfully");
    } catch (error) {
      log.error("Failed to clear session:", sanitizeError(error));
      // Dispatch logout anyway to update Redux state
      dispatch(logoutAction());
      throw error;
    }
  });
});
