import { useState, useEffect } from "react";
import NetInfo, {
  NetInfoState,
  NetInfoSubscription,
} from "@react-native-community/netinfo";

/**
 * Hook to reactively track if the device has lost its internet connection.
 * @returns {boolean} True if the device offline/disconnected.
 */
export const useIsOffline = (): boolean => {
  const [isOffline, setIsOffline] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribe: NetInfoSubscription | null = null;

    unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOffline(state.isConnected === false);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return isOffline;
};

/**
 * Asynchronous utility check for internet connectivity. Ideal for preflight
 * verification before a network request to bypass timeout hangs.
 * @returns Promise<boolean> True if online
 */
export const checkIsOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
};
