import { API, type AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { offlineSession } from "./offline-session";
import { sanitizeError } from "./log-sanitizer";
import { refreshTokenAttempt } from "./refresh-token-attempt";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// ─── Refresh Queue ──────────────────────────────────────────────────────────
// When multiple requests hit 401 simultaneously, only one refresh fires.
// All others wait in the queue and replay with the new token.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

// ─── Auth endpoints that should never trigger a refresh retry ────────────────
const AUTH_ENDPOINTS = [
  "auth/login",
  "auth/register",
  "auth/otp",
  "auth/refresh-token",
  "auth/logout",
];

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((ep) => url.includes(ep));
}

/**
 * Sets up Axios interceptors:
 * 1. Inject Authorization header with current token on every request
 * 2. On 401: attempt token refresh with queuing, replay original request on success
 * 3. On 403: notify app to refresh permissions in background
 *
 * @param onRefreshSuccess Optional callback invoked with the fresh AuthResponse after
 *   a successful interceptor-path refresh. Use this to sync Redux state so that
 *   auth.authResponse never holds stale session data.
 */
export function setupAxiosInterceptors(
  onRefreshSuccess?: (authResponse: AuthResponse) => void,
) {
  // ─── Request Interceptor ────────────────────────────────────────────────────
  API.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = tokenManager.get();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // ─── Response Interceptor ───────────────────────────────────────────────────
  API.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };
      const status = error.response?.status;
      const url = originalRequest?.url ?? "";

      // 401 on a non-auth endpoint → attempt refresh before logout
      if (
        status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !isAuthEndpoint(url)
      ) {
        // If another refresh is already in progress, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(API(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const result = await refreshTokenAttempt();

          if (result.success && result.newToken) {
            // Refresh succeeded — sync Redux state with fresh session data
            if (onRefreshSuccess) {
              try {
                const envelope = await tokenManager.loadSession<AuthResponse>();
                if (envelope?.data) {
                  onRefreshSuccess(envelope.data);
                }
              } catch (syncErr) {
                console.debug(
                  "[Interceptor] Redux sync after refresh failed:",
                  sanitizeError(syncErr),
                );
              }
            }

            // Extend offline session validity
            try {
              const session = await offlineSession.load();
              if (session) {
                await offlineSession.extendValidity(session);
              }
            } catch (offlineErr) {
              console.debug(
                "[Interceptor] Offline session extension failed:",
                sanitizeError(offlineErr),
              );
            }

            // Replay all queued requests with the new token
            processQueue(null, result.newToken);
            originalRequest.headers.Authorization = `Bearer ${result.newToken}`;
            return API(originalRequest);
          }

          // Refresh failed — determine whether to logout
          if (result.shouldLogout) {
            processQueue(error, null);
            tokenManager.notifyExpired();
            return Promise.reject(error);
          }

          // Network error during refresh — keep user logged in, fail this request
          processQueue(error, null);
          return Promise.reject(error);
        } catch (refreshError) {
          processQueue(refreshError, null);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // 403: Permissions changed server-side → background permission refresh
      if (status === 403) {
        tokenManager.notifyRefresh();
      }

      return Promise.reject(error);
    },
  );
}
