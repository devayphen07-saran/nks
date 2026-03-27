import { createAsyncThunk } from "@reduxjs/toolkit";
import { getSession, AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { setCredentials, logout as logoutAction } from "../slice/authSlice";
import type { AppDispatch } from "./index";

export const refreshSession = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/refreshSession", async (_, { dispatch }) => {
  try {
    const result = await dispatch(getSession({}));

    if (getSession.fulfilled.match(result)) {
      const fresh = result.payload as AuthResponse | undefined;

      if (fresh?.data?.session?.accessToken) {
        tokenManager.set(fresh.data.session.accessToken);
        await tokenManager.persistSession(fresh);
        dispatch(setCredentials(fresh));
        return;
      }

      // Fulfilled but token missing — malformed response, keep cached session
      console.warn("[Auth] refreshSession: server returned no token — keeping cached session");
      return;
    }

    if (getSession.rejected.match(result)) {
      const status = (result.payload as any)?.statusCode ?? (result.payload as any)?.status;
      if (status === 401) {
        tokenManager.clear();
        await tokenManager.clearSession();
        dispatch(logoutAction());
      }
      // Any other error (network, 5xx, etc.) — keep user logged in with cached session
    }
  } catch (e) {
    // Unexpected error — do NOT force logout, keep the cached session alive
    console.warn("[Auth] refreshSession failed unexpectedly — keeping cached session", e);
  }
});
