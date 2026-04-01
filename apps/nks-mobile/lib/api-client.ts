/**
 * Mobile API Client with Offline-First Support
 *
 * Features:
 * - Automatic Bearer token injection from SecureStore
 * - Request queueing when offline
 * - Auto-sync when online
 * - Unified error handling
 */

import NetInfo from '@react-native-community/netinfo';
import SecureSessionStorage from './secure-storage';
import SyncService from './sync-service';

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  data?: any;

  constructor(message: string, status?: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Make authenticated API call
 * Automatically handles token, offline queueing, and sync
 */
export async function authenticatedFetch<T = any>(
  endpoint: string,
  options: RequestInit & {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    skipQueue?: boolean; // Set to true to skip offline queueing (e.g., for read-only requests)
  } = {}
): Promise<T> {
  const { method = 'GET', skipQueue = false, ...rest } = options;

  // Check online status
  const netState = await NetInfo.fetch();
  const isOnline = netState.isConnected && netState.isInternetReachable;

  // ✅ If offline and mutation, queue it and return optimistic response
  if (!isOnline && method !== 'GET' && !skipQueue) {
    console.log(`📦 Offline mode: Queuing ${method} ${endpoint}`);

    const payload = rest.body ? JSON.parse(rest.body as string) : undefined;
    await SyncService.queueRequest(
      method as any,
      endpoint,
      payload,
      rest.headers as Record<string, string>
    );

    // Return optimistic response (client-side)
    return {
      status: 'success',
      data: { id: 'temp_' + Date.now(), ...payload },
      message: 'Queued for sync',
    } as T;
  }

  // ✅ Get auth token
  const token = await SecureSessionStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // ✅ Make request
  const url = `${process.env.EXPO_PUBLIC_API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      ...rest,
      headers,
    });

    const data = (await response.json()) as ApiResponse<T>;

    // ✅ Handle 401 (token expired)
    if (response.status === 401) {
      console.warn('⏰ Token expired, attempting refresh...');
      const refreshed = await SyncService.refreshToken();

      if (refreshed) {
        // Retry original request with new token
        return authenticatedFetch(endpoint, options);
      } else {
        // Refresh failed, user must re-login
        throw createApiError('Session expired. Please login again.', 401, 'AUTH_EXPIRED');
      }
    }

    if (!response.ok) {
      throw createApiError(
        data.message || 'API request failed',
        response.status,
        data.code,
        data
      );
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error - queue if mutation and offline
    if (!isOnline && method !== 'GET' && !skipQueue) {
      const payload = rest.body ? JSON.parse(rest.body as string) : undefined;
      await SyncService.queueRequest(
        method as any,
        endpoint,
        payload,
        rest.headers as Record<string, string>
      );

      return {
        status: 'success',
        data: { id: 'temp_' + Date.now(), ...payload },
        message: 'Queued for sync (network error)',
      } as T;
    }

    throw error;
  }
}

function createApiError(
  message: string,
  status?: number,
  code?: string,
  data?: any
): ApiError {
  return new ApiError(message, status, code, data);
}

/**
 * API Client with convenience methods
 */
export const apiClient = {
  // ✅ Auth endpoints
  auth: {
    register: (email: string, password: string, name: string) =>
      authenticatedFetch('/api/v1/auth/register', {
        method: 'POST',
        skipQueue: true,
        body: JSON.stringify({ email, password, name }),
      }),

    login: (email: string, password: string) =>
      authenticatedFetch('/api/v1/auth/login', {
        method: 'POST',
        skipQueue: true,
        body: JSON.stringify({ email, password }),
      }),

    logout: () =>
      authenticatedFetch('/api/v1/auth/sign-out', {
        method: 'POST',
        skipQueue: true,
      }),

    refreshToken: () =>
      authenticatedFetch('/api/v1/auth/refresh-token', {
        method: 'POST',
        skipQueue: true,
      }),
  },

  // ✅ User endpoints
  user: {
    getMe: () =>
      authenticatedFetch('/api/v1/users/me', {
        method: 'GET',
        skipQueue: true,
      }),

    updateProfile: (data: Record<string, any>) =>
      authenticatedFetch('/api/v1/users/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  // ✅ Store endpoints
  stores: {
    getMyStores: () =>
      authenticatedFetch('/api/v1/stores/my-stores', {
        method: 'GET',
        skipQueue: true,
      }),

    getInvitedStores: () =>
      authenticatedFetch('/api/v1/stores/invited-stores', {
        method: 'GET',
        skipQueue: true,
      }),

    selectStore: (storeId: number) =>
      authenticatedFetch('/api/v1/auth/store/select', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      }),
  },

  // ✅ Generic method for custom endpoints
  request: authenticatedFetch,
};

export default apiClient;
