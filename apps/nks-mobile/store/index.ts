import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { storeSlice } from "@nks/state-manager";
import { tokenManager } from "@nks/mobile-utils";
import { API } from "@nks/api-manager";
import { authReducer, logout } from "./auth-slice";
import { refreshSession } from "./refresh-session";
import { JWTManager } from '../lib/auth/jwt-manager';
import { offlineSession } from '../lib/auth/offline-session';
import { resetRefreshState } from '../lib/auth/jwt-refresh';
import { resetInterceptorState } from '../lib/auth/axios-interceptors';
import { createLogger } from '../lib/utils/logger';

const log = createLogger("Auth");

export const store = configureStore({
  reducer: {
    auth: authReducer,
    store: storeSlice.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useRootDispatch = () => useDispatch<AppDispatch>();

const useRootSelector = useSelector.withTypes<RootState>();

export const useAuthState = () => useRootSelector((state: RootState) => state.auth);
export const useAuthUser = () =>
  useRootSelector((state: RootState) => state.auth.authResponse?.user);

// Concurrency guard — prevents double-logout if notifyExpired() fires multiple
// times in quick succession (e.g. two simultaneous 401 responses).
let _logoutInProgress = false;

tokenManager.onExpired(async () => {
  if (_logoutInProgress) return;
  _logoutInProgress = true;

  try {
    // Best-effort backend signOut so the server-side session is explicitly
    // invalidated and appears in audit logs. Fire-and-forget — if the token
    // is already rejected by the server the call will 401, which is fine.
    API.post("/auth/logout").catch(() => {});

    tokenManager.clear();
    await tokenManager.clearSession();
    await offlineSession.clear();
    await JWTManager.clear();
    resetRefreshState();
    resetInterceptorState();
  } catch (error) {
    log.error("Failed to clear session on expiry:", error);
    // Continue anyway — dispatch logout to clear Redux state
  } finally {
    _logoutInProgress = false;
  }

  // Only dispatch after storage is definitely cleared
  store.dispatch(logout());
});

// 403 → permissions changed server-side → silently re-fetch a fresh session
tokenManager.onRefresh(() => {
  store.dispatch(refreshSession());
});
