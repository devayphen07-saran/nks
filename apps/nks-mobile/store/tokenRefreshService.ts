import { useAuth, initializeDatabase } from "@nks/local-db";
import { apiClient } from "@nks/api-manager";

/**
 * Service to handle automatic token refresh before requests
 * Call this before making any API request that requires authentication
 */
export async function ensureValidToken(): Promise<string | null> {
  try {
    // Initialize database if needed
    await initializeDatabase();

    const authDb = useAuth();

    // Get current session
    const session = await authDb.getActiveSession();
    if (!session) {
      console.warn("No active session found");
      return null;
    }

    // Check if token is expired
    if (session.isAccessTokenExpired()) {
      // Token is expired, need to refresh
      console.log("Access token expired, attempting refresh...");

      const refreshToken = session.refreshToken;
      if (!refreshToken || session.isRefreshTokenExpired()) {
        console.warn("Refresh token is also expired or missing");
        return null;
      }

      try {
        // Call refresh endpoint
        const response = await apiClient.post("/auth/refresh-token", {
          refreshToken,
        });

        const refreshData = response.data?.data || response.data;

        // Update local token
        const newAccessToken = refreshData.accessToken || refreshData.access_token;
        const newRefreshToken = refreshData.refreshToken || refreshData.refresh_token;
        const expiresIn = refreshData.expiresIn || refreshData.access_expires_in || 3600;

        if (newAccessToken) {
          await authDb.updateToken(newAccessToken, newRefreshToken || refreshToken, expiresIn);
          console.log("Token refreshed successfully");
          return newAccessToken;
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        return null;
      }
    }

    // Check if token needs refresh (< 5 minutes until expiry)
    if (session.needsRefresh()) {
      console.log("Token expiring soon, proactively refreshing...");

      const refreshToken = session.refreshToken;
      if (!refreshToken || session.isRefreshTokenExpired()) {
        // Can't refresh, but token is still valid
        return session.accessToken;
      }

      try {
        const response = await apiClient.post("/auth/refresh-token", {
          refreshToken,
        });

        const refreshData = response.data?.data || response.data;
        const newAccessToken = refreshData.accessToken || refreshData.access_token;
        const newRefreshToken = refreshData.refreshToken || refreshData.refresh_token;
        const expiresIn = refreshData.expiresIn || refreshData.access_expires_in || 3600;

        if (newAccessToken) {
          await authDb.updateToken(newAccessToken, newRefreshToken || refreshToken, expiresIn);
          console.log("Token refreshed proactively");
          return newAccessToken;
        }
      } catch (error) {
        console.warn("Proactive token refresh failed, but token is still valid:", error);
        // Don't return null here, token is still valid
      }
    }

    // Token is still valid
    return session.accessToken;
  } catch (error) {
    console.error("Error ensuring valid token:", error);
    return null;
  }
}

/**
 * Check if user is logged in (has valid session)
 */
export async function isUserLoggedIn(): Promise<boolean> {
  try {
    await initializeDatabase();
    const authDb = useAuth();
    return authDb.isLoggedIn();
  } catch {
    return false;
  }
}

/**
 * Get current access token without refresh
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    await initializeDatabase();
    const authDb = useAuth();
    return authDb.getAccessToken();
  } catch {
    return null;
  }
}

/**
 * Clear all auth data (logout)
 */
export async function clearAuthData(): Promise<void> {
  try {
    await initializeDatabase();
    const authDb = useAuth();
    await authDb.clearAuth();
  } catch (error) {
    console.error("Error clearing auth data:", error);
  }
}
