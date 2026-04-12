import React, { createContext, useContext, useEffect, useRef } from "react";
import * as SplashScreen from "expo-splash-screen";
import NetInfo from "@react-native-community/netinfo";
import type { AuthResponse } from "@nks/api-manager";
import { useRootDispatch, useAuth as useReduxAuth } from "../store";
import { setCredentials } from "../store/auth-slice";
import { initializeAuth } from "../store/initialize-auth";
import { setupAxiosInterceptors } from "./axios-interceptors";
import { handleReconnection } from "../services/reconnection-handler";
import { useInactivityLock } from "../hooks/useInactivityLock";

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

  // Lock app after 5 min in background — prompts biometric on foreground
  useInactivityLock();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // ✅ PHASE 3: Setup Axios interceptors when provider mounts
  // Moved from store/index.ts for graceful error handling
  // Interceptors are non-critical for startup, app works without them (though no token refresh)
  useEffect(() => {
    try {
      setupAxiosInterceptors((authResponse: AuthResponse) => {
        dispatch(setCredentials(authResponse));
      });
      console.log("[Auth] Axios interceptors configured");
    } catch (error) {
      console.error("[Auth] Failed to setup Axios interceptors:", error);
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
  // to sync roles, permissions, clock offset, and offline token
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = state.isConnected ?? false;

      if (!isOnline) {
        wasOffline.current = true;
        return;
      }

      // Online transition detected — run full reconnection sequence
      if (wasOffline.current) {
        wasOffline.current = false;
        console.log("[Auth] Device back online — running reconnection sequence");
        handleReconnection(dispatch).catch((err) => {
          console.error("[Auth] Reconnection failed:", err);
        });
      }
    });

    return () => unsubscribe();
  }, [isAuthenticated, dispatch]);

  return (
    <AuthContext.Provider
      value={{ isLoggedIn: isAuthenticated, isLoading: isInitializing }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuthGuard = () => useContext(AuthContext);
