import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { userProfileSlice, storeSlice } from "@nks/state-manager";
import { tokenManager } from "@nks/mobile-utils";
import { authReducer, selectAuthData, selectUser, selectSession, selectAccess, selectAuthContext, selectFeatureFlags } from "../slice/authSlice";
import { authListenerMiddleware } from "../slice/middleware";
import { setUnauthenticated } from "../slice/authSlice";
import { refreshSession } from "./refreshSession";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    userProfile: userProfileSlice.reducer,
    store: storeSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authListenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useRootDispatch = () => useDispatch<AppDispatch>();

const useRootSelector = useSelector.withTypes<RootState>();

export const useAuth = () => useRootSelector((state: RootState) => state.auth);

// Convenient selectors for accessing nested auth data
export const useAuthData = () => useRootSelector((state: RootState) => selectAuthData(state.auth));
export const useUser = () => useRootSelector((state: RootState) => selectUser(state.auth));
export const useSession = () => useRootSelector((state: RootState) => selectSession(state.auth));
export const useAccess = () => useRootSelector((state: RootState) => selectAccess(state.auth));
export const useAuthContext = () => useRootSelector((state: RootState) => selectAuthContext(state.auth));
export const useFeatureFlags = () => useRootSelector((state: RootState) => selectFeatureFlags(state.auth));

// 401 → clear session, set unauthenticated → root navigator shows login
tokenManager.onExpired(async () => {
  await tokenManager.clearSession();
  store.dispatch(setUnauthenticated());
});

// 403 → permissions changed server-side → silently re-fetch a fresh session
tokenManager.onRefresh(() => {
  store.dispatch(refreshSession());
});
