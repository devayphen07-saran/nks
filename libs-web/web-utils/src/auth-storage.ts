"use client";

/**
 * Auth Storage Keys
 */
export const AUTH_STORAGE_KEYS = {
  accessToken: "accessToken",
  refreshToken: "refreshToken",
  sessionId: "sessionId",
  user: "user",
  iamUserId: "iamUserId",
} as const;

/**
 * Token Management
 */
export const getAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  } catch (e) {
    console.warn("[Storage] Failed to read access token from storage:", e);
    return null;
  }
};

export const setAccessToken = (token: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, token);
  } catch (e) {
    console.warn("[Storage] Failed to save access token to storage:", e);
  }
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
  } catch (e) {
    console.warn("[Storage] Failed to read refresh token from storage:", e);
    return null;
  }
};

export const setRefreshToken = (token: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, token);
  } catch (e) {
    console.warn("[Storage] Failed to save refresh token to storage:", e);
  }
};

/**
 * Session ID Management
 */
export const getSessionId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.sessionId);
  } catch (e) {
    console.warn("[Storage] Failed to read session ID from storage:", e);
    return null;
  }
};

export const setSessionId = (id: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.sessionId, id);
  } catch (e) {
    console.warn("[Storage] Failed to save session ID to storage:", e);
  }
};

/**
 * User ID Management
 */
export const getIamUserId = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.iamUserId);
  } catch (e) {
    console.warn("[Storage] Failed to read IAM user ID from storage:", e);
    return null;
  }
};

export const setIamUserIdToken = (id: string): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.iamUserId, id);
  } catch (e) {
    console.warn("[Storage] Failed to save IAM user ID to storage:", e);
  }
};

/**
 * User Profile Management
 */
export const getUser = <T = unknown>(): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const user = localStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (!user) return null;
    return JSON.parse(user) as T;
  } catch (e) {
    console.warn("[Storage] Failed to read user from storage:", e);
    return null;
  }
};

export const setUser = <T>(user: T): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTH_STORAGE_KEYS.user, JSON.stringify(user));
  } catch (e) {
    console.warn("[Storage] Failed to save user to storage:", e);
  }
};

/**
 * Write the RS256 JWT to a readable (non-httpOnly) cookie so Next.js middleware
 * can decode the signed payload for role-based routing.
 * Max-age matches the JWT lifetime (1 hour = 3600 s).
 */
export const setJwtCookie = (token: string): void => {
  if (typeof document === "undefined") return;
  document.cookie = `nks_jwt=${token}; path=/; SameSite=Lax; max-age=3600`;
};

export const clearJwtCookie = (): void => {
  if (typeof document === "undefined") return;
  document.cookie = "nks_jwt=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
};

/**
 * Persist auth session to localStorage.
 * The httpOnly nks_session cookie is set by the backend — we never touch it here.
 * We store:
 *   - authData in localStorage for fast Redux restore on page refresh
 *   - refreshToken in localStorage for token rotation
 *   - nks_jwt (signed JWT) in a readable cookie for Next.js middleware routing
 *   - nks_auth=1 as a plain presence flag (same as nks_session but readable by middleware)
 */
export const persistAuthSession = (authData: Record<string, any>): void => {
  if (typeof window === "undefined" || !authData) return;
  try {
    if (authData.user?.id) setIamUserIdToken(String(authData.user.id));
    if (authData.session?.refreshToken) setRefreshToken(authData.session.refreshToken);
    if (authData.session?.jwtToken) setJwtCookie(authData.session.jwtToken);
    setUser(authData);
    document.cookie = "nks_auth=1; path=/; SameSite=Lax";
  } catch (e) {
    console.warn("[Storage] Failed to persist auth session:", e);
  }
};

/**
 * Global Cleanup
 */
export const clearAuthData = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    localStorage.removeItem(AUTH_STORAGE_KEYS.iamUserId);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    document.cookie = "nks_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    clearJwtCookie();
  } catch (e) {
    console.warn("Failed to clear auth data from storage:", e);
  }
};
