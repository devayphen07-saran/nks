/**
 * App-level Axios interceptors for nks-mobile.
 *
 * Boundary with @nks/mobile-utils:
 *   - mobile-utils/axios-interceptors: provides `createAxiosInstance()` — the factory
 *     that wires up base URL, timeout, and the token-injection request interceptor.
 *   - THIS FILE (nks-mobile/lib/axios-interceptors): sets up the 401/403 response
 *     interceptors on the shared `API` instance. These reference app-level singletons
 *     (tokenMutex, refreshTokenAttempt, offlineSession) that live in nks-mobile, not
 *     in the shared library.
 *
 * Rule: never import nks-mobile singletons from mobile-utils, and never put app-level
 * business logic (refresh queue, mutex, offline session) into mobile-utils.
 */

import { API, type AuthResponse } from "@nks/api-manager";
import { tokenManager } from "@nks/mobile-utils";
import { sanitizeError } from "../utils/log-sanitizer";
import { createLogger } from "../utils/logger";
import { refreshTokenAttempt } from "./refresh-token-attempt";

const log = createLogger("AxiosInterceptors");
import { tokenMutex } from "./token-mutex";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

// ─── Refresh Queue ──────────────────────────────────────────────────────────
// When multiple requests hit 401 simultaneously, only one refresh fires.
// All others wait in the queue and replay with the new token.
//
// tokenMutex (same singleton as refresh-session.ts / logout-thunk.ts) ensures
// that the actual refresh call is serialised across the whole app — an
// interceptor-triggered refresh and a Redux-triggered refreshSession can never
// both call refreshTokenAttempt() at the same time.

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

// Track interceptor IDs so we can eject before re-registering on remount.
// Without this, every call to setupAxiosInterceptors stacks another interceptor
// (hot reload in dev, or React StrictMode double-mounting AuthProvider).
let _requestInterceptorId: number | null = null;
let _responseInterceptorId: number | null = null;

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
/**
 * Resets interceptor module state. Call on logout to prevent stale
 * isRefreshing flag and queued requests from leaking across user sessions.
 */
export function resetInterceptorState(): void {
  isRefreshing = false;
  failedQueue = [];
}

export function setupAxiosInterceptors(
  onRefreshSuccess?: (authResponse: AuthResponse) => void,
) {
  // Eject any previously registered interceptors before re-registering.
  // Without this, every remount (hot reload, React StrictMode) stacks duplicates.
  if (_requestInterceptorId !== null) {
    API.interceptors.request.eject(_requestInterceptorId);
  }
  if (_responseInterceptorId !== null) {
    API.interceptors.response.eject(_responseInterceptorId);
  }

  // ─── Request Interceptor ────────────────────────────────────────────────────
  _requestInterceptorId = API.interceptors.request.use(
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
  _responseInterceptorId = API.interceptors.response.use(
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
          // Use shared tokenMutex so this refresh is serialised with
          // Redux refreshSession and logout — prevents dual-refresh race.
          // withRefreshLock returns undefined if another refresh was already
          // running (it waits for it to complete and returns undefined).
          const result = await tokenMutex.withRefreshLock(() => refreshTokenAttempt());

          // mutex_skip: another refresh completed while we were waiting.
          // Get whatever token that refresh produced and replay the request.
          if (result === undefined) {
            const currentToken = tokenManager.get();
            if (currentToken) {
              processQueue(null, currentToken);
              originalRequest.headers.Authorization = `Bearer ${currentToken}`;
              return API(originalRequest);
            }
            processQueue(error, null);
            return Promise.reject(error);
          }

          if (result.success && result.newToken) {
            // Refresh succeeded — sync Redux state with fresh session data
            if (onRefreshSuccess) {
              try {
                const envelope = await tokenManager.loadSession<AuthResponse>();
                if (envelope?.data) {
                  onRefreshSuccess(envelope.data);
                }
              } catch (syncErr) {
                log.debug(
                  "[Interceptor] Redux sync after refresh failed:",
                  sanitizeError(syncErr),
                );
              }
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
