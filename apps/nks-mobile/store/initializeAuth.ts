import { createAsyncThunk } from "@reduxjs/toolkit";
import { AuthResponse } from "@nks/api-manager";
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";
import { setCredentials, setUnauthenticated } from "../slice/authSlice";
import { refreshSession } from "./refreshSession";
import type { AppDispatch } from "./index";

// Called once when the app launches — restores session or sends user to login
export const initializeAuth = createAsyncThunk<
  void,
  void,
  { dispatch: AppDispatch }
>("auth/bootstrap", async (_, { dispatch }) => {
  try {
    const envelope = await tokenManager.loadSession<AuthResponse>();

    if (!envelope?.data?.data?.session?.accessToken) {
      dispatch(setUnauthenticated());
      return;
    }

    tokenManager.set(envelope.data.data.session.accessToken);
    dispatch(setCredentials(envelope.data));

    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    const missingPermissions = !envelope.data.data?.access?.permissions?.length;
    if (isStale || missingPermissions) dispatch(refreshSession());
  } catch (e) {
    console.error('[Auth:init] error:', e);
    dispatch(setUnauthenticated());
  }
});
