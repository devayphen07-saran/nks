import { API } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { tokenRefreshManager } from "../store/TokenRefreshManager";

/**
 * Sets up Axios interceptors to:
 * 1. Ensure token is valid before making requests (proactive refresh)
 * 2. Add Authorization header with current token to all requests
 * 3. Handle 401 token expiry by notifying the app
 * 4. Handle 403 permission changes by triggering background refresh
 */
export function setupAxiosInterceptors() {
  // ─── Request Interceptor ──────────────────────────────────────────────
  // 1. Ensure token is valid (refresh if needed)
  // 2. Add Authorization header with current token
  API.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      try {
        // Ensure token is valid (will refresh if needed)
        const isValid = await tokenRefreshManager.ensureValidToken();

        if (!isValid) {
          // Token refresh failed, request will fail with 401
          console.warn("[AxiosInterceptor] Token refresh failed, proceeding with potentially invalid token");
        }

        const token = tokenManager.get();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      } catch (error) {
        console.error("[AxiosInterceptor] Error in request interceptor:", error);
        const token = tokenManager.get();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      }
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // ─── Response Interceptor ──────────────────────────────────────────────
  // Handles token expiry (401) and permission changes (403)
  API.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const status = error.response?.status;

      // 401 Unauthorized: Token expired or invalid
      // Notify the app to clear session and show login screen
      if (status === 401) {
        tokenManager.notifyExpired();
      }

      // 403 Forbidden: Permissions may have changed
      // Trigger background session refresh to get updated permissions
      if (status === 403) {
        tokenManager.notifyRefresh();
      }

      return Promise.reject(error);
    },
  );
}
