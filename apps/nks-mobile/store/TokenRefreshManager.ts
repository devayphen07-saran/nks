import { useAuth, initializeDatabase } from "@nks/local-db";
import { apiClient } from "@nks/api-manager";
import { useDispatch } from "react-redux";
import { logoutUser } from "./logoutUser";

/**
 * TokenRefreshManager - Handles token refresh with:
 * - Mutex to prevent race conditions (multiple simultaneous refreshes)
 * - Exponential backoff retry logic (1s, 2s, 4s)
 * - Automatic logout on refresh failure
 */
class TokenRefreshManager {
  private refreshPromise: Promise<boolean> | null = null;
  private dispatch: any = null;

  setDispatch(dispatch: any) {
    this.dispatch = dispatch;
  }

  /**
   * Ensure token is valid, refreshing if needed
   * Uses mutex to prevent multiple simultaneous refresh requests
   */
  async ensureValidToken(): Promise<boolean> {
    // Mutex: if already refreshing, wait for that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Internal: Perform the actual refresh with retry logic
   */
  private async performRefresh(): Promise<boolean> {
    try {
      await initializeDatabase();
      const authDb = useAuth();

      // Get current session
      const session = await authDb.getActiveSession();
      if (!session) {
        console.warn("[TokenRefresh] No active session found");
        return false;
      }

      // Token still valid - no refresh needed
      if (!session.isAccessTokenExpired() && !session.needsRefresh()) {
        return true;
      }

      // Refresh token expired - must logout
      if (session.isRefreshTokenExpired()) {
        console.warn("[TokenRefresh] Refresh token expired, logging out");
        if (this.dispatch) {
          await this.dispatch(logoutUser());
        }
        return false;
      }

      // Attempt refresh with exponential backoff
      return await this.refreshWithRetry(session.refreshToken);
    } catch (error) {
      console.error("[TokenRefresh] Unexpected error during refresh:", error);
      return false;
    }
  }

  /**
   * Refresh token with exponential backoff retry
   */
  private async refreshWithRetry(
    refreshToken: string,
    attempt = 0,
    maxAttempts = 3
  ): Promise<boolean> {
    try {
      console.log(`[TokenRefresh] Attempt ${attempt + 1}/${maxAttempts}`);

      const response = await apiClient.post("/auth/refresh-token", {
        refreshToken,
      });

      const refreshData = response.data?.data || response.data;
      const newAccessToken = refreshData.accessToken || refreshData.access_token;
      const newRefreshToken =
        refreshData.refreshToken || refreshData.refresh_token;
      const expiresIn =
        refreshData.expiresIn ||
        refreshData.access_expires_in ||
        refreshData.expiresInSeconds ||
        3600;

      if (newAccessToken) {
        const authDb = useAuth();
        await authDb.updateToken(
          newAccessToken,
          newRefreshToken || refreshToken,
          expiresIn
        );
        console.log("[TokenRefresh] Token refreshed successfully");
        return true;
      } else {
        console.error("[TokenRefresh] No access token in response");
        return false;
      }
    } catch (error: any) {
      const status = error.response?.status;

      // 401 Unauthorized - refresh token invalid
      if (status === 401) {
        console.warn("[TokenRefresh] Refresh token invalid (401), logging out");
        if (this.dispatch) {
          await this.dispatch(logoutUser());
        }
        return false;
      }

      // Retry on server errors (5xx) and rate limits (429)
      if ((status >= 500 || status === 429) && attempt < maxAttempts - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(
          `[TokenRefresh] Retry attempt ${attempt + 2} after ${delayMs}ms. Error: ${error.message}`
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.refreshWithRetry(refreshToken, attempt + 1, maxAttempts);
      }

      // Network error or other client error - give up
      console.error("[TokenRefresh] Refresh failed after retries:", error.message);
      return false;
    }
  }
}

// Singleton instance
export const tokenRefreshManager = new TokenRefreshManager();

/**
 * Initialize the manager with Redux dispatch
 * Call this in your app root component
 */
export function initializeTokenRefreshManager(dispatch: any) {
  tokenRefreshManager.setDispatch(dispatch);
}
