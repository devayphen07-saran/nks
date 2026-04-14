import { useCallback } from "react";
import { Alert } from "react-native";
import { useLogout } from "./useLogout";

export function useLogoutConfirmation() {
  const { logout } = useLogout();

  const confirmLogout = useCallback(
    (onLoggedOut?: () => void) => {
      Alert.alert(
        "Logout",
        "Are you sure you want to log out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Logout",
            style: "destructive",
            onPress: () => {
              logout(onLoggedOut).catch((error) => {
                console.error("[Logout] Failed:", error);
                Alert.alert("Error", "Failed to log out. Please try again.");
              });
            },
          },
        ],
      );
    },
    [logout],
  );

  return { confirmLogout };
}
