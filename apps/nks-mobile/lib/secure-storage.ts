/**
 * Secure Token Storage for React Native
 *
 * Stores sensitive data in encrypted secure storage:
 * - Android: EncryptedSharedPreferences (AES-256)
 * - iOS: Keychain
 *
 * Uses expo-secure-store which provides platform-native encryption
 */

import * as SecureStore from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'auth.session_token';
const JWT_TOKEN_KEY = 'auth.jwt_token';
const TOKEN_EXPIRES_AT_KEY = 'auth.token_expires_at';
const USER_DATA_KEY = 'auth.user_data';

export interface StoredUser {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  phoneNumber?: string;
  image?: string;
}

/**
 * ✅ Secure encrypted storage for authentication tokens
 * Never access tokens via JavaScript (unlike localStorage)
 * Tokens are encrypted at rest using OS-level encryption
 */
export const SecureSessionStorage = {
  /**
   * Save session token to encrypted storage
   * Called after login/register/refresh
   */
  saveToken: async (
    sessionToken: string,
    expiresAt: Date,
    jwtToken?: string
  ): Promise<void> => {
    try {
      // ✅ Store session token (for server validation)
      await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);

      // ✅ Store JWT token (for offline validation)
      if (jwtToken) {
        await SecureStore.setItemAsync(JWT_TOKEN_KEY, jwtToken);
      }

      // ✅ Store expiry time
      await SecureStore.setItemAsync(
        TOKEN_EXPIRES_AT_KEY,
        expiresAt.toISOString()
      );

      console.log(
        `✅ Token saved (expires: ${expiresAt.toLocaleString()})`
      );
    } catch (error) {
      console.error('❌ Failed to save token:', error);
      throw error;
    }
  },

  /**
   * Retrieve session token from encrypted storage
   * Returns null if not found or if expired
   */
  getToken: async (): Promise<string | null> => {
    try {
      const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
      if (!token) {
        console.warn('⚠️ No session token found');
        return null;
      }

      // Check expiry
      const expiresAt = await SecureStore.getItemAsync(
        TOKEN_EXPIRES_AT_KEY
      );
      if (expiresAt && new Date() > new Date(expiresAt)) {
        console.warn('⏰ Session token expired');
        return null;
      }

      return token;
    } catch (error) {
      console.error('❌ Failed to retrieve token:', error);
      return null;
    }
  },

  /**
   * Retrieve JWT token for offline validation
   * Used by mobile app to validate token claims without server
   */
  getJWTToken: async (): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(JWT_TOKEN_KEY);
    } catch (error) {
      console.error('❌ Failed to retrieve JWT:', error);
      return null;
    }
  },

  /**
   * Check if current token is expired
   */
  isTokenExpired: async (): Promise<boolean> => {
    try {
      const expiresAt = await SecureStore.getItemAsync(
        TOKEN_EXPIRES_AT_KEY
      );
      if (!expiresAt) return true;
      return new Date() > new Date(expiresAt);
    } catch {
      return true;
    }
  },

  /**
   * Get time until token expires (in seconds)
   */
  getTokenTTL: async (): Promise<number> => {
    try {
      const expiresAt = await SecureStore.getItemAsync(
        TOKEN_EXPIRES_AT_KEY
      );
      if (!expiresAt) return 0;
      const ttl = Math.floor(
        (new Date(expiresAt).getTime() - Date.now()) / 1000
      );
      return Math.max(ttl, 0);
    } catch {
      return 0;
    }
  },

  /**
   * Save user profile for offline access
   * Allows app to display user info without network
   */
  saveUserData: async (user: StoredUser): Promise<void> => {
    try {
      await SecureStore.setItemAsync(USER_DATA_KEY, JSON.stringify(user));
      console.log(`✅ User profile saved (${user.email})`);
    } catch (error) {
      console.error('❌ Failed to save user data:', error);
    }
  },

  /**
   * Retrieve user profile from storage
   */
  getUserData: async (): Promise<StoredUser | null> => {
    try {
      const data = await SecureStore.getItemAsync(USER_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Failed to retrieve user data:', error);
      return null;
    }
  },

  /**
   * Clear all tokens (called on logout)
   * ✅ CRITICAL: Must clear tokens to prevent reuse after logout
   */
  clearToken: async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
      await SecureStore.deleteItemAsync(JWT_TOKEN_KEY);
      await SecureStore.deleteItemAsync(TOKEN_EXPIRES_AT_KEY);
      await SecureStore.deleteItemAsync(USER_DATA_KEY);
      console.log('✅ All tokens cleared (user logged out)');
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error);
    }
  },

  /**
   * Check if user is logged in
   * Returns true if valid token exists
   */
  isLoggedIn: async (): Promise<boolean> => {
    const token = await SecureSessionStorage.getToken();
    return !!token;
  },
};

export default SecureSessionStorage;
