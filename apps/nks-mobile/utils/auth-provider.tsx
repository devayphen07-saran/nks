import React, { createContext, useContext, useEffect, useRef } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useRootDispatch, useAuth as useReduxAuth } from "../store";
import { initializeAuth } from "../store/initializeAuth";
import {
  tokenRefreshManager,
  initializeTokenRefreshManager,
} from "../store/TokenRefreshManager";
import { useProactiveTokenRefresh } from "../hooks/useProactiveTokenRefresh";

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  isLoggedIn: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  isLoggedIn: false,
  isLoading: true,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useRootDispatch();
  const { isInitializing, isAuthenticated } = useReduxAuth();
  const splashHidden = useRef(false);

  // Initialize token refresh manager and activate proactive token refresh
  useEffect(() => {
    initializeTokenRefreshManager(dispatch);
  }, [dispatch]);

  // Activate proactive token refresh (checks every 60 seconds)
  useProactiveTokenRefresh();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  useEffect(() => {
    if (!isInitializing && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => {});
      splashHidden.current = true;
    }
  }, [isInitializing]);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: isAuthenticated, isLoading: isInitializing }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
// Returns { isLoggedIn, isLoading } — navigation guard values only.
// For full auth state (user, permissions, loginState) use useAuth() from ../store.

export const useAuthGuard = () => useContext(AuthContext);

