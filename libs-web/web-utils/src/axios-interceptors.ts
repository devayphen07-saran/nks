"use client";

import { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosInstance } from "axios";
import { API, IamAPI } from "@nks/api-manager";
import { clearAuthData } from "./auth-storage";

/**
 * Extended AxiosError with custom permission error metadata
 */
interface PermissionError extends AxiosError {
  isForbidden?: boolean;
  forbiddenMessage?: string;
}

/**
 * Get CSRF Token from cookies
 * Backend sets it as an httpOnly cookie after auth
 */
const getCsrfToken = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)X-CSRF-Token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

/**
 * Interceptor Registration Utility
 */
const setupInterceptors = (instance: AxiosInstance): void => {
  // Request Interceptor - Add CSRF Token for mutations
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // ✅ SECURITY: Add CSRF token for state-changing operations
      // GET requests don't need CSRF protection (they're read-only)
      const method = config.method?.toUpperCase();
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method || "")) {
        const csrfToken = getCsrfToken();
        if (csrfToken && config.headers) {
          config.headers["X-CSRF-Token"] = csrfToken;
        }
      }

      // ✅ SECURITY: Don't add Bearer token manually
      // Axios uses credentials: 'include' to send httpOnly cookies automatically
      // The backend sets auth tokens in httpOnly cookies after login/register
      // No manual token injection needed - browser handles it!
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // Response Interceptor - Handle 401 & Refresh Token
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error?.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      const status = error?.response?.status;
      const isAuthError = status === 401;
      const isForbiddenError = status === 403;
      const isLoginRequest = originalRequest?.url?.includes("auth/login");
      const isRegisterRequest = originalRequest?.url?.includes("auth/register");
      const isRefreshRequest = originalRequest?.url?.includes("auth/refresh-token");

      // Skip retry on auth endpoints
      if (isLoginRequest || isRegisterRequest) {
        return Promise.reject(error);
      }

      // Handle 401 - Session expired
      // ✅ SECURITY: With httpOnly cookies, token refresh is handled by backend
      // We just redirect to login on 401
      if (
        isAuthError &&
        originalRequest &&
        !originalRequest._retry &&
        !isRefreshRequest
      ) {
        originalRequest._retry = true;

        try {
          // Attempt to refresh token via backend
          // Backend will set new httpOnly cookie in response
          await API.post("/auth/refresh-token");

          // Retry original request with new auth cookie (auto-sent by browser)
          return instance(originalRequest);
        } catch (refreshErr) {
          // Refresh failed - session is invalid, clear state and redirect to login
          clearAuthData();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
          return Promise.reject(refreshErr);
        }
      }

      // Handle 403 Forbidden - Insufficient permissions
      if (isForbiddenError) {
        const responseData = error?.response?.data as Record<string, unknown> | undefined;
        // Attach permission error metadata to error for UI to handle
        const permError = error as PermissionError;
        permError.isForbidden = true;
        permError.forbiddenMessage =
          (responseData?.message as string) || "You do not have permission to access this resource";
      }

      return Promise.reject(error);
    },
  );
};

// Apply to all instances
setupInterceptors(API);
setupInterceptors(IamAPI);

/**
 * Initialization Marker
 */
export const INTERCEPTORS_INITIALIZED = true;
