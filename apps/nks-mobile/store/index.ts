import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { storeSlice } from "@nks/state-manager";
import { tokenManager } from "@nks/mobile-utils";
import { authReducer } from "./auth-slice";
import { setUnauthenticated } from "./auth-slice";
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

// HIGH FIX #2: Make logout atomic — clear storage BEFORE updating Redux state
// Prevents race condition where Redux is cleared but SecureStore still has old token
tokenManager.onExpired(async () => {
  if (_logoutInProgress) return;
  _logoutInProgress = true;

  try {
    // Clear all auth state — we skip the backend signOut call because the
    // session is already expired/invalid (that's why onExpired fired).
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
  store.dispatch(setUnauthenticated());
});

// 403 → permissions changed server-side → silently re-fetch a fresh session
tokenManager.onRefresh(() => {
  store.dispatch(refreshSession());
});
