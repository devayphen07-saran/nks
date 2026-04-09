import { createAsyncThunk } from "@reduxjs/toolkit";
import type { AuthResponse } from "@nks/api-manager";
import { tokenManager, SESSION_STALE_MS } from "@nks/mobile-utils";
import { offlineSession } from "../lib/offline-session";
import { setCredentials, setUnauthenticated } from "./authSlice";
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

    // envelope.data is AuthResponse = { requestId, ..., data: { user, session, ... } }
    if (!envelope?.data?.data?.session?.sessionToken) {
      dispatch(setUnauthenticated());
      return;
    }

    tokenManager.set(envelope.data.data.session.sessionToken);
    dispatch(setCredentials(envelope.data));

    // Restore offline session for offline POS capability
    try {
      const session = await offlineSession.load();
      if (session) {
        if (offlineSession.isValid(session)) {
          console.log("[Auth:init] OfflineSession restored (valid)", {
            userId: session.userId,
            storeId: session.storeId,
            expiresIn: session.offlineValidUntil - Date.now(),
          });
        } else {
          console.warn("[Auth:init] OfflineSession expired", {
            userId: session.userId,
            expiredAt: new Date(session.offlineValidUntil).toISOString(),
          });
        }
      }
    } catch (error) {
      console.debug("[Auth:init] Failed to restore offline session:", error);
    }

    const isStale = Date.now() - envelope.fetchedAt > SESSION_STALE_MS;
    if (isStale) dispatch(refreshSession());
  } catch (e) {
    console.error("[Auth:init] error:", e);
    dispatch(setUnauthenticated());
  }
});
