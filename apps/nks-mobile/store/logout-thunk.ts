import { createAsyncThunk } from "@reduxjs/toolkit";
import { signOut } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { logout as logoutAction } from "./auth-slice";
import { tokenMutex } from "../lib/token-mutex";
import { offlineSession } from "../lib/offline-session";
import { sanitizeError } from "../lib/log-sanitizer";
import { JWTManager } from "../lib/jwt-manager";
import { OTP_RATE_LIMITS } from "../lib/rate-limiter";
import type { AppDispatch } from "./index";

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
        // Log sanitized error, continue with logout anyway
        console.error("[Logout] Sign-out API failed:", sanitizeError(error));
      }

      tokenManager.clear();
      await tokenManager.clearSession();
      await offlineSession.clear();
      await JWTManager.clear();
      // Reset OTP rate limiters so a fresh login session starts clean
      OTP_RATE_LIMITS.verify.reset();
      OTP_RATE_LIMITS.resend.reset();
      OTP_RATE_LIMITS.send.reset();
      dispatch(logoutAction());
      console.log("[Logout] Session and offline data cleared successfully");
    } catch (error) {
      // Log sanitized error
      console.error("[Logout] Failed to clear session:", sanitizeError(error));
      // Dispatch logout anyway to update Redux state
      dispatch(logoutAction());
      throw error;
    }
  });
});
