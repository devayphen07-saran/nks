"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { type AuthData, signOut, getMe } from "@nks/api-manager";
import { authSlice } from "@nks/state-manager";
import { clearAuthData, getUser } from "./auth-storage";

// ============================================
// Context Types
// ============================================

export interface AuthContextType {
  user: AuthData | null;
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
  dispatch: (action: unknown) => unknown;
  authState: {
    user: AuthData | null;
    status: "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED" | "LOCKED";
  };
}

export function AuthProvider({
  children,
  dispatch,
  authState,
}: AuthProviderProps) {
  const { user, status } = authState;
  const [isInitialized, setIsInitialized] = useState(false);
  const [iamUserId, setIamUserId] = useState<string | null>(null);
  const isAuthenticated = status === "AUTHENTICATED";
  const isLoading = status === "INITIALIZING" || !isInitialized;

  // Sync iamUserId from user state
  useEffect(() => {
    if (user?.user?.id) setIamUserId(String(user.user.id));
  }, [user]);

  // ============================================
  // Redirect to Auth with Return URL
  // ============================================

  const redirectToAuth = useCallback(() => {
    const authUrl = process.env.NEXT_PUBLIC_AUTH_URL ?? "/login";
    if (typeof window === "undefined") return;
    const currentUrl = window.location.href;
    if (currentUrl.includes("/login")) return;
    window.location.href = `${authUrl}?redirect=${encodeURIComponent(currentUrl)}`;
  }, []);

  // Single consolidated logout: clears storage, calls backend, then redirects.
  // redirectToAuth() is deferred until signOut() resolves so the backend has
  // cleared the nks_session httpOnly cookie before the next navigation.
  const logout = useCallback(() => {
    clearAuthData();
    setIamUserId(null);
    (dispatch(signOut()) as Promise<unknown>).finally(() => {
      redirectToAuth();
    });
  }, [dispatch, redirectToAuth]);

  // ============================================
  // Session Restoration on Page Refresh
  // ============================================

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Restore from localStorage immediately for fast UI render
        const storedSession = getUser<AuthData>();
        if (storedSession?.session?.sessionToken) {
          dispatch(authSlice.actions.setAuthenticated(storedSession));
        } else {
          dispatch(authSlice.actions.setUnauthenticated());
          setIsInitialized(true);
          return;
        }

        // 2. Verify the session is still valid on the backend (cookie may be
        //    expired or revoked since the last page visit)
        await (dispatch(getMe()) as Promise<unknown>)
          .then((result: unknown) => {
            const action = result as { payload?: unknown; error?: unknown };
            if (action.error) {
              if (action.payload) {
                // Server responded with an auth error (e.g. 401) — session truly invalid.
                clearAuthData();
                dispatch(authSlice.actions.setUnauthenticated());
              }
              // payload is undefined = network error (backend temporarily down).
              // Keep the existing session so the user isn't logged out.
            }
          })
          .catch(() => {
            // Synchronous error — keep session intact.
          });
      } catch (error) {
        // Unexpected synchronous error during init — keep session intact.
        console.error("[Auth] Initialization error:", error);
      } finally {
        setIsInitialized(true);
      }
    };

    initAuth();
  }, [dispatch]);

  return (
    <AuthContext.Provider
      value={{
        user,
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
