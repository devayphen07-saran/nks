import { createAxiosInstance } from "./axios-interceptors";

// Environment variable or configuration for the base API URL
// In a real app, this should come from Expo Constants or an environment file.
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1";

/**
 * Centralized API client for all mobile network requests.
 * Uses a pre-configured Axios instance with:
 * - Bearer Token injection (from SecureStore)
 * - 401 Unauthorized -> Token Refresh logic
 * - 429 Rate Limiting -> Exponential Backoff
 * - 5xx Server Errors -> Automatic Retry (up to 3 times)
 */
export const apiClient = createAxiosInstance(BASE_URL);

/**
 * Utility for making typed GET requests
 */
export const apiGet = <T>(url: string, params?: any): Promise<T> => {
  return apiClient.get(url, { params }).then((res) => res.data);
};

/**
 * Utility for making typed POST requests
 */
export const apiPost = <T>(url: string, data?: any): Promise<T> => {
  return apiClient.post(url, data).then((res) => res.data);
};

/**
 * Utility for making typed PUT requests
 */
export const apiPut = <T>(url: string, data?: any): Promise<T> => {
  return apiClient.put(url, data).then((res) => res.data);
};

