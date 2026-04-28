import React, { createContext, useContext, useEffect, useRef } from "react";
import * as SplashScreen from "expo-splash-screen";
import NetInfo from "@react-native-community/netinfo";
import type { AuthResponse } from "@nks/api-manager";
import { useRootDispatch, useAuthState as useReduxAuth } from "../../store";
import { setCredentials } from "../../store/auth-slice";
import { initializeAuth } from "../../store/initialize-auth";
import { setupAxiosInterceptors } from "./axios-interceptors";
import { handleReconnection } from "../../services/reconnection-handler";
import { createLogger } from "../utils/logger";

const log = createLogger("AuthProvider");

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
  const wasOffline = useRef(false);
  // Ref so the NetInfo listener always sees current auth state without
  // re-subscribing (and re-running the cleanup) on every login/logout cycle.
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  useEffect(() => {
    try {
      setupAxiosInterceptors((authResponse: AuthResponse) => {
        dispatch(setCredentials(authResponse));
      });
      log.info("[Auth] Axios interceptors configured");
    } catch (error) {
      log.error("[Auth] Failed to setup Axios interceptors:", error);
      // Non-critical — continue anyway
    }
  }, [dispatch]);

  useEffect(() => {
    if (!isInitializing && !splashHidden.current) {
      SplashScreen.hideAsync().catch(() => {});
      splashHidden.current = true;
    }
  }, [isInitializing]);

  // Reconnection handler: when device goes offline→online, refresh session
  // to sync roles, permissions, clock offset, and offline token.
  // Deps: [dispatch] only — isAuthenticated is read via ref so the listener
  // is never torn down and re-created on login/logout state changes.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected ?? false;

      if (!isOnline) {
        wasOffline.current = true;
        return;
      }

      // Online transition detected — run full reconnection sequence (auth only)
      if (wasOffline.current && isAuthenticatedRef.current) {
        wasOffline.current = false;
        log.info("[Auth] Device back online — running reconnection sequence");
        // Fire-and-forget: if this fails, the next foreground event or API 401
        // will trigger a fresh refresh. Awaiting here would block the UI thread
        // on a potentially slow network immediately after reconnection.
        handleReconnection(dispatch).catch((err) => {
          log.error("[Auth] Reconnection failed:", err);
        });
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: isAuthenticated, isLoading: isInitializing }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuthContext = () => useContext(AuthContext);
