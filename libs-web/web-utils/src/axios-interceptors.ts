"use client";

import { InternalAxiosRequestConfig, AxiosError, AxiosResponse, AxiosInstance } from "axios";
import { API, IamAPI } from "@nks/api-manager";
import { getAccessToken, setAccessToken, clearAuthData } from "./auth-storage";

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
  // Request Interceptor - Attaches Bearer Token
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (typeof window !== "undefined") {
        const token = getAccessToken();
        if (token && config.headers) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      }
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

      // Handle 401 - Attempt refresh
      if (
        isAuthError &&
        originalRequest &&
        !originalRequest._retry &&
        !isRefreshRequest
      ) {
        originalRequest._retry = true;

        try {
          const oldToken = getAccessToken();
          if (!oldToken) throw new Error("No access token found");

          const refreshResp = await API.post(
            "/auth/refresh-token",
            { token: oldToken },
          );

          const newAccessToken = refreshResp?.data?.data?.token;
          if (!newAccessToken) throw new Error("Invalid refresh response");

          // Token rotation: only update if token actually changed
          if (newAccessToken !== oldToken) {
            setAccessToken(newAccessToken);
          }

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers["Authorization"] =
              `Bearer ${newAccessToken}`;
          }

          return instance(originalRequest);
        } catch (refreshErr) {
          // Refresh failed - session invalid, clean up
          // Let auth provider handle redirect when it detects invalid session
          clearAuthData();
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
