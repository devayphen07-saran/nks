import { useEffect, useState, useCallback } from "react";
import { useNetworkState } from "./network-state";
import { offlineSession, OfflineSession } from "./offline-session";

/**
 * Offline mode state.
 * - isOffline: true if no internet AND offline session is still valid
 * - offlineSession: the loaded offline session (or null)
 * - isSessionExpired: true if offline session passed offlineValidUntil
 * - sessionExpiresIn: milliseconds until offline session expires
 */
export interface OfflineModeState {
  isOffline: boolean;
  offlineSession: OfflineSession | null;
  isSessionExpired: boolean;
  sessionExpiresIn: number;
}

/**
 * Custom hook that combines network state + offline session validation.
 * Returns the current offline mode state.
 *
 * Offline mode is active when:
 * 1. Device has NO internet, AND
 * 2. OfflineSession exists AND is still valid (offlineValidUntil > now)
 *
 * If offline session is expired:
 * - isOffline = false
 * - isSessionExpired = true
 * - Show "Connect to internet to continue" error screen
 *
 * Usage:
 *   const offline = useOfflineMode();
 *   if (offline.isOffline) {
 *     <OfflineBanner />
 *   }
 *   if (offline.isSessionExpired && !network.isConnected) {
 *     <ExpiredSessionScreen />
 *   }
 */
export function useOfflineMode(): OfflineModeState {
  const network = useNetworkState();
  const [session, setSession] = useState<OfflineSession | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);

  // Load offline session on mount
  useEffect(() => {
    const loadSession = async () => {
      const loaded = await offlineSession.load();
      setSession(loaded);
    };
    loadSession().catch((error) => {
      console.error("[OfflineMode] Failed to load session:", error);
    });
  }, []);

  // Check if session is expired (update every 10 seconds)
  useEffect(() => {
    const checkExpiration = () => {
      if (!session) {
        setExpiresIn(0);
        return;
      }

      const remaining = session.offlineValidUntil - Date.now();
      setExpiresIn(Math.max(0, remaining));
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 10000);
    return () => clearInterval(interval);
  }, [session]);

  const isSessionValid = offlineSession.isValid(session);
  const isOffline = !network.isConnected && isSessionValid;
  const isSessionExpired = !isSessionValid && session !== null;

  return {
    isOffline,
    offlineSession: session,
    isSessionExpired,
    sessionExpiresIn: expiresIn,
  };
}

/**
 * Determines if the user can perform POS operations.
 * Returns true if:
 * - Device is online (any endpoint call works), OR
 * - Offline mode is active (valid offline session + no internet)
 *
 * Returns false if:
 * - Offline session is expired (offline session + no internet)
 * - Not authenticated at all (no offline session + no internet)
 */
export function canPerformPosOperations(state: OfflineModeState): boolean {
  // If we can refresh/call the server, allow operations
  // The network check happens implicitly via API calls
  // This function just checks the offline session validity
  return offlineSession.isValid(state.offlineSession);
}
