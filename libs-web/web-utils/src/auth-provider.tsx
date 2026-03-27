"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { getSession, type AuthResponse } from "@nks/api-manager";
import { authSlice } from "@nks/state-manager";
import {
  setAccessToken,
  getAccessToken,
  clearAuthData,
  setIamUserIdToken,
  setSessionId,
} from "./auth-storage";

// ============================================
// Context Types
// ============================================

export interface AuthContextType {
  user: AuthResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  iamUserId: string | null;
  logout: () => void;
}

// ============================================
// Context & Provider
// ============================================

const AuthContext = createContext<AuthContextType | null>(null);

export interface AuthProviderProps {
  children: ReactNode;
  dispatch: (action: unknown) => Promise<unknown>;
  authState: {
    user: AuthResponse | null;
    status: "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "LOCKED";
  };
}

export function AuthProvider({
  children,

  dispatch,
  authState,
}: AuthProviderProps) {
  const { user: rawUser, status } = authState;
  const user = (rawUser as any)?.data ?? rawUser;
  const [isInitialized, setIsInitialized] = useState(false);
  const [iamUserId, setIamUserId] = useState<string | null>(null);
  const isAuthenticated = status === "AUTHENTICATED";
  const isLoading = status === "INITIALIZING" || !isInitialized;

  // ============================================
  // Redirect to Auth with Return URL
  // ============================================

  const redirectToAuth = useCallback(() => {
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "/login";

    if (typeof window === "undefined") {
      return;
    }

    const currentUrl = window.location.href;

    // Prevent redirect loop if already on auth URL
    if (currentUrl.includes("/login")) {
      return;
    }

    const redirectUrl = `${authUrl}?redirect=${encodeURIComponent(currentUrl)}`;
    window.location.href = redirectUrl;
  }, []);

  const logout = useCallback(() => {
    clearAuthData();
    setIamUserId(null);
    dispatch(authSlice.actions.setUnauthenticated());
    redirectToAuth();
  }, [dispatch, redirectToAuth]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const urlToken = urlParams.get("accessToken");

          if (urlToken) {
            setAccessToken(urlToken);
            const url = new URL(window.location.href);
            url.searchParams.delete("accessToken");
            window.history.replaceState({}, "", url.toString());
          }
        }

        const token = getAccessToken();

        if (!token) {
          dispatch(authSlice.actions.setUnauthenticated());
          redirectToAuth();
          return;
        }

        // Token exists, validate with backend via getSession
        try {
          const result = await dispatch(getSession({}));

          if (getSession.fulfilled.match(result)) {
            // Response structure: payload.data = ApiResponse wrapper, payload.data.data = AuthResponseDto
            const authData = result.payload?.data?.data || result.payload?.data;

            if (authData) {
              // Extract and store iamUserId from auth response
              const userId = authData?.data?.user?.id || authData?.user?.id;
              if (userId) {
                setIamUserId(String(userId));
                setIamUserIdToken(String(userId));
              }

              // Extract and store sessionId from auth response
              const sessionId = authData?.session?.sessionId;
              if (sessionId) {
                setSessionId(sessionId);
              }

              // Auth successful
              dispatch(authSlice.actions.setAuthenticated(authData));
            } else {
              throw new Error("Invalid session response structure");
            }
          } else if (getSession.rejected.match(result)) {
            console.warn("[Auth] Session validation failed");
            clearAuthData();
            redirectToAuth();
          }
        } catch (sessionErr) {
          console.warn("[Auth] Session validation error:", sessionErr);
          clearAuthData();
          dispatch(authSlice.actions.setUnauthenticated());
          redirectToAuth();
        }
      } catch (error) {
        console.error("[Auth] Initialization error:", error);
        clearAuthData();
        dispatch(authSlice.actions.setUnauthenticated());
      } finally {
        setIsInitialized(true);
      }
    };

    initAuth();
  }, [dispatch, redirectToAuth]);

  return (
    <AuthContext.Provider
      value={{
        user: user as AuthContextType["user"],
        isLoading,
        isAuthenticated,
        iamUserId,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
