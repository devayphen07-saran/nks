import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { tokenRefreshManager } from "../store/TokenRefreshManager";

/**
 * Hook to proactively refresh token before it expires
 *
 * Checks token every 60 seconds and refreshes if:
 * - Token is expired
 * - Token expires within 5 minutes
 *
 * Should be called once at app root level
 */
export function useProactiveTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout>();
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[useProactiveTokenRefresh] Initializing token refresh monitor");

    // Initial check
    tokenRefreshManager.ensureValidToken().catch((error) => {
      console.error("[useProactiveTokenRefresh] Initial refresh failed:", error);
    });

    // Check every 60 seconds
    intervalRef.current = setInterval(async () => {
      try {
        await tokenRefreshManager.ensureValidToken();
      } catch (error) {
        console.error("[useProactiveTokenRefresh] Periodic refresh failed:", error);
      }
    }, 60000); // 60 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [dispatch]);
}
