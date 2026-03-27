/**
 * Routes Cache - SessionStorage persistence
 * Caches routes/permissions within a session to avoid re-fetching on page refresh
 */

const ROUTES_CACHE_KEY = "nks-routes-cache";

export interface RoutesCacheData {
  routes: any[];
  permissions: any[];
  isSynced: boolean;
  fetchedAt: number;
}

export const routesCache = {
  save: (data: RoutesCacheData) => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(ROUTES_CACHE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error("[Routes Cache] Failed to save:", err);
    }
  },

  load: (): RoutesCacheData | null => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem(ROUTES_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error("[Routes Cache] Failed to load:", err);
      return null;
    }
  },

  clear: () => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.removeItem(ROUTES_CACHE_KEY);
    } catch (err) {
      console.error("[Routes Cache] Failed to clear:", err);
    }
  },
};
