import { useEffect, useState, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";

/**
 * Network state information.
 * - isConnected: true if device has internet connectivity
 * - isWiFi: true if connected via WiFi
 * - isCellular: true if connected via cellular data
 */
export interface NetworkState {
  isConnected: boolean;
  isWiFi: boolean;
  isCellular: boolean;
}

/**
 * Custom hook to detect network connectivity state.
 * Listens for network changes using NetInfo and updates state in real-time.
 *
 * Usage:
 *   const network = useNetworkState();
 *   if (!network.isConnected) {
 *     // Show offline UI
 *   }
 */
export function useNetworkState(): NetworkState {
  const [state, setState] = useState<NetworkState>({
    isConnected: true, // Assume online initially (will update on first check)
    isWiFi: false,
    isCellular: false,
  });

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Get initial state
    const checkInitialState = async () => {
      const netState = await NetInfo.fetch();
      setState({
        isConnected: netState.isConnected ?? false,
        isWiFi: netState.type === "wifi",
        isCellular: netState.type === "cellular",
      });
      setInitialized(true);
    };

    checkInitialState().catch((error) => {
      console.error("[NetworkState] Failed to fetch initial state:", error);
      setInitialized(true);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((netState) => {
      setState({
        isConnected: netState.isConnected ?? false,
        isWiFi: netState.type === "wifi",
        isCellular: netState.type === "cellular",
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}

/**
 * Returns true if the device is online.
 * Use in non-component code (e.g., in thunks or services).
 *
 * This is a one-time check, not a continuous listener.
 * For continuous detection in React components, use useNetworkState() instead.
 */
export async function isDeviceOnline(): Promise<boolean> {
  const netState = await NetInfo.fetch();
  return netState.isConnected ?? false;
}
