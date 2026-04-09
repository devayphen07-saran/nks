import { API } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { offlineSession } from "./offline-session";
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

/**
 * Reads the stored refresh token from SecureStore and calls POST /auth/refresh-token.
 * On success: updates in-memory token + persisted session. Returns new session token.
 * On failure: returns null.
 */
async function attemptRefresh(): Promise<string | null> {
  try {
    const envelope = await tokenManager.loadSession<any>();
    const refreshTokenValue = envelope?.data?.data?.session?.refreshToken;
    if (!refreshTokenValue) return null;

    // Call refresh endpoint directly — bypasses the request interceptor's token injection
    // because the endpoint is public (no AuthGuard). Expired Bearer header is ignored.
    const response = await API.post("/auth/refresh-token", {
      refreshToken: refreshTokenValue,
    });

    const result = response.data?.data;
    const newSessionToken = result?.sessionToken;
    const newRefreshToken = result?.refreshToken;
    if (!newSessionToken) return null;

    // Update in-memory token
    tokenManager.set(newSessionToken);

    // Update persisted session with rotated tokens
    if (envelope?.data) {
      const updated = {
        ...envelope.data,
        data: {
          ...envelope.data.data,
          session: {
            ...envelope.data.data.session,
            sessionToken: newSessionToken,
            ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
            ...(result?.expiresAt ? { expiresAt: result.expiresAt } : {}),
            ...(result?.refreshExpiresAt
              ? { refreshExpiresAt: result.refreshExpiresAt }
              : {}),
          },
        },
      };
      await tokenManager.persistSession(updated);
    }

    return newSessionToken;
  } catch (err: unknown) {
    const axiosErr = err as AxiosError | undefined;

    // Server explicitly rejected the refresh token (401/403) → return null → will logout
    if (
      axiosErr?.response?.status === 401 ||
      axiosErr?.response?.status === 403
    ) {
      return null;
    }

    // Network error / timeout / server down → throw so interceptor keeps session alive
    throw err;
  }
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
 * 1. Add Authorization header with current token to all requests
 * 2. On 401: attempt token refresh with queue, retry original request on success
 * 3. On 403: notify app to refresh permissions in background
 */
export function setupAxiosInterceptors() {
  // ─── Request Interceptor ──────────────────────────────────────────────
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

  // ─── Response Interceptor ──────────────────────────────────────────────
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
          const newToken = await attemptRefresh();

          if (newToken) {
            // Refresh succeeded — replay all queued requests
            processQueue(null, newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;

            // Extend offline session validity (reset to +7 days)
            try {
              const session = await offlineSession.load();
              if (session) {
                await offlineSession.extendValidity(session);
              }
            } catch (error) {
              // Offline session extension failed — not critical
              console.debug(
                "[Interceptor] Offline session extension failed:",
                error,
              );
            }

            return API(originalRequest);
          }

          // Refresh returned null → server rejected the refresh token → force logout
          processQueue(error, null);
          tokenManager.notifyExpired();
          return Promise.reject(error);
        } catch (refreshError) {
          // Network error during refresh → DON'T logout, just fail the original request
          // User stays logged in with cached session. They can retry when connectivity returns.
          processQueue(refreshError, null);
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // 403: Permissions changed server-side → background refresh
      if (status === 403) {
        tokenManager.notifyRefresh();
      }

      return Promise.reject(error);
    },
  );
}
