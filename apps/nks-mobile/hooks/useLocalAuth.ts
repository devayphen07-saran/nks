import { useEffect, useState } from "react";
import { useAuth as useLocalDb, initializeDatabase } from "@nks/local-db";

/**
 * Hook to access local auth data from WatermelonDB
 * Initializes database on first use
 *
 * Usage:
 *   const { user, session, roles, isLoggedIn } = useLocalAuth();
 */
export function useLocalAuth() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        // Initialize database
        await initializeDatabase();
        const authDb = useLocalDb();

        // Load data
        const [userData, sessionData, rolesData, loggedIn] = await Promise.all([
          authDb.getCurrentUser(),
          authDb.getActiveSession(),
          authDb.getActiveRoles(0), // Will be populated from session
          authDb.isLoggedIn(),
        ]);

        setUser(userData || null);
        setSession(sessionData || null);
        setRoles(rolesData || []);
        setIsLoggedIn(loggedIn);
        setIsReady(true);
      } catch (error) {
        console.warn("Failed to load local auth data:", error);
        setIsReady(true);
      }
    };

    loadAuthData();
  }, []);

  return {
    isReady,
    user,
    session,
    roles,
    isLoggedIn,
  };
}

/**
 * Hook to get current access token
 */
export function useAccessToken() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        await initializeDatabase();
        const authDb = useLocalDb();
        const accessToken = await authDb.getAccessToken();
        setToken(accessToken);
      } catch (error) {
        console.warn("Failed to load access token:", error);
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, []);

  return { token, loading };
}

/**
 * Hook to check if token needs refresh
 */
export function useTokenRefreshStatus() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const checkToken = async () => {
      try {
        await initializeDatabase();
        const authDb = useLocalDb();
        const session = await authDb.getActiveSession();

        if (!session) {
          setIsExpired(true);
          return;
        }

        setIsExpired(session.isAccessTokenExpired());
        setNeedsRefresh(session.needsRefresh());
      } catch (error) {
        console.warn("Failed to check token status:", error);
      }
    };

    checkToken();

    // Re-check every minute
    const interval = setInterval(checkToken, 60000);
    return () => clearInterval(interval);
  }, []);

  return { needsRefresh, isExpired };
}

/**
 * Hook to check user permissions
 */
export function usePermission() {
  const hasPermission = async (permissionCode: string, storeId?: number): Promise<boolean> => {
    try {
      await initializeDatabase();
      const authDb = useLocalDb();
      const session = await authDb.getActiveSession();

      if (!session) return false;

      // Get current user ID from session
      return authDb.hasPermission(session.userId, permissionCode, storeId);
    } catch (error) {
      console.warn("Failed to check permission:", error);
      return false;
    }
  };

  return { hasPermission };
}

/**
 * Hook to check user role
 */
export function useRole() {
  const hasRole = async (roleCode: string, storeId?: number): Promise<boolean> => {
    try {
      await initializeDatabase();
      const authDb = useLocalDb();
      const session = await authDb.getActiveSession();

      if (!session) return false;

      return authDb.hasRole(session.userId, roleCode, storeId);
    } catch (error) {
      console.warn("Failed to check role:", error);
      return false;
    }
  };

  return { hasRole };
}
