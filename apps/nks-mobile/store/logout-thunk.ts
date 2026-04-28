import { createAsyncThunk } from "@reduxjs/toolkit";
import { signOut } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { logout as logoutAction } from "./auth-slice";
import { tokenMutex } from '../lib/auth/token-mutex';
import { offlineSession } from '../lib/auth/offline-session';
import { sanitizeError } from '../lib/utils/log-sanitizer';
import { JWTManager } from '../lib/auth/jwt-manager';
import { clearRateLimiters } from '../lib/utils/rate-limiter';
import { resetRefreshState } from '../lib/auth/jwt-refresh';
import { resetInterceptorState } from '../lib/auth/axios-interceptors';
import { resetSyncState } from '../lib/sync/sync-engine';
import { resetServerTime } from '../lib/utils/server-time';
import { DeviceManager } from '../lib/device/device-manager';
import { createLogger } from '../lib/utils/logger';
import { clearAllTables } from "../lib/local-db";
import { deleteDbKey } from '../lib/device/db-key';
import type { AppDispatch } from "./index";

const log = createLogger("Logout");

export const logoutThunk = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/logout", async (_, { dispatch }) => {
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

      // Always delete the DB encryption key so the next session (same or different user)
      // cannot access any residual schema or cached data from this session.
      try {
        await deleteDbKey();
      } catch (err) {
        log.error("Failed to delete DB key on logout:", err);
      }

      // Clear OTP rate limiters (removes persisted state from AsyncStorage)
      await clearRateLimiters();
      resetServerTime();
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
