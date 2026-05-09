import { createAsyncThunk } from "@reduxjs/toolkit";
import { signOut } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { clearActiveStore } from "@nks/state-manager";
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

      // Clear OTP rate limiters (removes persisted state from AsyncStorage)
      await clearRateLimiters();
      resetServerTime();

      // Clear Redux: auth slice (auth-slice.logout) and the company slice's
      // active-store fields. Without clearing the company slice, the next
      // user's session inherits the previous user's activeStoreGuuid and
      // the auth-provider effect kicks off a sync against a store the new
      // user has no access to → 403.
      dispatch(logoutAction());
      dispatch(clearActiveStore());

      // Delete the DB encryption key LAST. This is the security boundary:
      // without the key, the SQLite file becomes unreadable on next startup
      // even if clearAllTables left rows behind. Done last so all the
      // best-effort cleanups above run regardless, but its failure is fatal
      // — it propagates out of the thunk so the UI can surface it instead
      // of pretending logout succeeded while a different user could still
      // open the previous user's encrypted DB.
      await deleteDbKey();

      log.info("Session and offline data cleared successfully");
    } catch (error) {
      log.error("Failed to clear session:", sanitizeError(error));
      // Dispatch logout anyway to update Redux state
      dispatch(logoutAction());
      dispatch(clearActiveStore());
      throw error;
    }
  });
});
