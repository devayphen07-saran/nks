import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { tokenManager } from "../storage/token-manager";

// Constants for retry logic
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000; // Base delay for backoff

/**
 * Creates an Axios instance with pre-configured interceptors for:
 * 1. Authorization — sync in-memory token (tokenManager), 401 → session expired
 * 2. Rate Limiting (429 → exponential backoff)
 * 3. Server Errors (5xx → retry)
 */
export const createAxiosInstance = (baseUrl: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request Interceptor: Attach in-memory token — synchronous, zero I/O
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = tokenManager.get();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response Interceptor: Global Error Handling & Retry Logic
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const { config, response } = error;

      if (!config) return Promise.reject(error);

      const retryCount = (config as any)._retryCount || 0;

      // 401 and 403 handling is intentionally omitted here.
      // The app-level interceptor in nks-mobile/lib/auth/axios-interceptors.ts owns
      // the 401 refresh-queue logic and 403 permission-refresh notification.
      // Handling 401 here would fire before the app interceptor and trigger immediate
      // logout instead of allowing the queued refresh to complete.

      // 2. Handle 429 Too Many Requests (Exponential Backoff)
      if (response?.status === 429 && retryCount < MAX_RETRY_ATTEMPTS) {
        (config as any)._retryCount = retryCount + 1;
        const delay = Math.pow(2, retryCount) * RETRY_DELAY_MS;

        console.warn(
          `[Axios] 429 Rate limited. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return instance(config);
      }

      // 3. Handle 5xx Server Errors (Exponential Backoff)
      if (
        response &&
        response.status >= 500 &&
        retryCount < MAX_RETRY_ATTEMPTS
      ) {
        (config as any)._retryCount = retryCount + 1;
        const delay = Math.pow(2, retryCount) * RETRY_DELAY_MS;

        console.warn(
          `[Axios] ${response.status} Server error. Retrying in ${delay}ms... (Attempt ${retryCount + 1})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return instance(config);
      }

      if (!response) {
        console.error("[Axios] Network Error:", error.message);
      } else {
        console.error(`[Axios] Error (${response.status}):`, response.data);
      }

      return Promise.reject(error);
    },
  );

  return instance;
};
