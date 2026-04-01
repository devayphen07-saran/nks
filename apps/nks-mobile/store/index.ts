import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { userProfileSlice, storeSlice, userPreferencesSlice } from "@nks/state-manager";
import { tokenManager } from "@nks/mobile-utils";
import {
  authReducer,
  selectAuthData,
  selectUser,
  selectSession,
  selectAccess,
  selectAuthContext,
  selectFeatureFlags,
} from "../slice/authSlice";
import { authListenerMiddleware } from "../slice/middleware";
import { setUnauthenticated } from "../slice/authSlice";
import { refreshSession } from "./refreshSession";
import { configMasterSlice } from "@nks/state-manager";
import { setupAxiosInterceptors } from "../utils/axios-interceptors";
import { tokenRefreshManager } from "./TokenRefreshManager";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userProfile: userProfileSlice.reducer,
    userPreferences: userPreferencesSlice.reducer,
    store: storeSlice.reducer,
    config: configMasterSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authListenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useRootDispatch = () => useDispatch<AppDispatch>();

const useRootSelector = useSelector.withTypes<RootState>();

export const useAuth = () => useRootSelector((state: RootState) => state.auth);
export const useConfig = () =>
  useRootSelector((state: RootState) => state.config);
export const useUserProfile = () =>
  useRootSelector((state: RootState) => state.userProfile);
export const useUserPreferences = () =>
  useRootSelector((state: RootState) => state.userPreferences);

// 401 → clear session, set unauthenticated → root navigator shows login
tokenManager.onExpired(async () => {
  await tokenManager.clearSession();
  store.dispatch(setUnauthenticated());
});

// 403 → permissions changed server-side → silently re-fetch a fresh session
tokenManager.onRefresh(() => {
  store.dispatch(refreshSession());
});

// Setup Axios interceptors to add Authorization header and handle token expiry
setupAxiosInterceptors();
