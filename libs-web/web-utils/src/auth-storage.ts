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
 * Global Cleanup
 */
export const clearAuthData = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
    localStorage.removeItem(AUTH_STORAGE_KEYS.sessionId);
    localStorage.removeItem(AUTH_STORAGE_KEYS.user);
    localStorage.removeItem(AUTH_STORAGE_KEYS.iamUserId);
  } catch (e) {
    console.warn("Failed to clear auth data from storage:", e);
  }
};
