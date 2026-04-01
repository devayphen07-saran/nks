/**
 * useAuth Hook
 *
 * Manages authentication state and operations for the mobile app
 * Handles: login, logout, token refresh, offline detection
 */

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SecureSessionStorage from '../lib/secure-storage';
import SyncService from '../lib/sync-service';
import apiClient from '../lib/api-client';
import type { StoredUser } from '../lib/secure-storage';

export interface AuthState {
  isLoggedIn: boolean;
  user: StoredUser | null;
  loading: boolean;
  error: string | null;
  isOnline: boolean;
  pendingSync: number; // Number of queued requests
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    isLoggedIn: false,
    user: null,
    loading: true,
    error: null,
    isOnline: true,
    pendingSync: 0,
  });

  // ✅ Initialize auth state on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  // ✅ Watch for connectivity changes
  useEffect(() => {
    const unsubscribe = SyncService.watchConnectivity();
    return () => unsubscribe?.();
  }, []);

  // ✅ Check pending sync every 30 seconds
  useEffect(() => {
    const interval = setInterval(updateSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Initialize authentication state
   * Called on app load - restores user session if exists
   */
  const initializeAuth = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      const isLoggedIn = await SecureSessionStorage.isLoggedIn();
      if (!isLoggedIn) {
        setState((prev) => ({
          ...prev,
          isLoggedIn: false,
          loading: false,
        }));
        return;
      }

      // Restore user data
      const user = await SecureSessionStorage.getUserData();
      setState((prev) => ({
        ...prev,
        isLoggedIn: true,
        user,
        loading: false,
      }));

      // Try to sync any pending requests
      await SyncService.syncQueue();
      await updateSyncStatus();
    } catch (error) {
      console.error('❌ Auth initialization failed:', error);
      setState((prev) => ({
        ...prev,
        error: String(error),
        loading: false,
      }));
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(
    async (email: string, password: string, name: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const response = await apiClient.auth.register(email, password, name);

        // Save tokens
        await SecureSessionStorage.saveToken(
          response.session.sessionToken || response.session.accessToken,
          new Date(response.session.expiresAt),
          response.session.jwtToken
        );

        // Save user
        await SecureSessionStorage.saveUserData(response.user);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          user: response.user,
          loading: false,
        }));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Registration failed';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          loading: false,
        }));
        throw error;
      }
    },
    []
  );

  /**
   * Login user
   */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const response = await apiClient.auth.login(email, password);

        // Save tokens
        await SecureSessionStorage.saveToken(
          response.session.sessionToken || response.session.accessToken,
          new Date(response.session.expiresAt),
          response.session.jwtToken
        );

        // Save user
        await SecureSessionStorage.saveUserData(response.user);

        setState((prev) => ({
          ...prev,
          isLoggedIn: true,
          user: response.user,
          loading: false,
        }));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Login failed';
        setState((prev) => ({
          ...prev,
          error: errorMsg,
          loading: false,
        }));
        throw error;
      }
    },
    []
  );

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));

      // Attempt server logout (may fail if offline)
      try {
        await apiClient.auth.logout();
      } catch (error) {
        console.warn('⚠️ Server logout failed (may be offline)');
      }

      // Clear local storage
      await SecureSessionStorage.clearToken();

      // Clear sync queue
      await SyncService.clearQueue();

      setState({
        isLoggedIn: false,
        user: null,
        loading: false,
        error: null,
        isOnline: true,
        pendingSync: 0,
      });
    } catch (error) {
      console.error('❌ Logout failed:', error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: String(error),
      }));
    }
  }, []);

  /**
   * Refresh token manually
   */
  const refreshToken = useCallback(async () => {
    try {
      const success = await SyncService.refreshToken();
      if (!success) {
        throw new Error('Token refresh failed');
      }

      // Fetch updated user profile
      const user = await apiClient.user.getMe();
      await SecureSessionStorage.saveUserData(user);

      setState((prev) => ({
        ...prev,
        user,
        error: null,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Token refresh failed';
      setState((prev) => ({
        ...prev,
        error: errorMsg,
      }));
      throw error;
    }
  }, []);

  /**
   * Sync offline requests
   */
  const syncNow = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const result = await SyncService.syncQueue();
      setState((prev) => ({
        ...prev,
        loading: false,
        error: result.success ? null : 'Sync failed for some requests',
      }));
      return result;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: String(error),
      }));
      throw error;
    }
  }, []);

  /**
   * Update sync status (number of pending requests)
   */
  const updateSyncStatus = useCallback(async () => {
    try {
      const queue = await SyncService.getQueue();
      setState((prev) => ({
        ...prev,
        pendingSync: queue.length,
      }));
    } catch (error) {
      console.error('❌ Failed to update sync status:', error);
    }
  }, []);

  return {
    ...state,
    // Methods
    register,
    login,
    logout,
    refreshToken,
    syncNow,
    // Debug
    getSyncStats: SyncService.getStats,
  };
};

export default useAuth;
