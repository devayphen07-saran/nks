"use client";

import { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosInstance } from "axios";
import { API, IamAPI } from "@nks/api-manager";
import { clearAuthData, getRefreshToken, setRefreshToken, setJwtCookie } from "./auth-storage";

/**
 * Extended AxiosError with custom permission error metadata
 */
interface PermissionError extends AxiosError {
  isForbidden?: boolean;
  forbiddenMessage?: string;
}

/**
 * Interceptor Registration Utility
 */
const setupInterceptors = (instance: AxiosInstance): void => {
  // Request Interceptor
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // ✅ SECURITY: Don't add Bearer token manually.
      // Axios uses withCredentials: true to send the nks_session httpOnly cookie
      // automatically. The backend reads it in AuthGuard.
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
      const url = originalRequest?.url ?? "";
      const isLoginRequest = url.includes("auth/login");
      const isRegisterRequest = url.includes("auth/register");
      const isRefreshRequest = url.includes("auth/refresh-token");
      const isLogoutRequest = url.includes("auth/logout");
      const isOtpRequest = url.includes("auth/otp");
      const isSessionRequest = url.includes("routes/admin") || url.includes("auth/me");

      // Skip refresh retry on auth/OTP endpoints — these should surface errors directly
      if (isLoginRequest || isRegisterRequest || isLogoutRequest || isOtpRequest || isSessionRequest) {
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
          // Send stored refresh token in body — backend reads it to rotate the session.
          // The nks_session cookie is also sent automatically (withCredentials: true)
          // but it contains the session token, not the refresh token.
          const refreshToken = getRefreshToken();
          const refreshResponse = await API.post("/auth/refresh-token", refreshToken ? { refreshToken } : undefined);

          // Persist rotated tokens so the next expiry cycle works correctly
          const refreshData = (refreshResponse.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
          if (refreshData?.refreshToken) setRefreshToken(refreshData.refreshToken as string);
          if (refreshData?.jwtToken) setJwtCookie(refreshData.jwtToken as string);

          // Retry original request — browser auto-sends the new nks_session cookie
          return instance(originalRequest);
        } catch (refreshErr) {
          // Refresh failed — call logout so the backend clears the nks_session
          // httpOnly cookie (frontend JS cannot clear httpOnly cookies directly).
          // Fire-and-forget: we don't await or care if it fails.
          API.post("/auth/logout").catch(() => {});
          clearAuthData();
          if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
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
