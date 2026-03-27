import { Alert, Linking, Platform } from "react-native";
import {
  useCameraPermissions,
  PermissionStatus as CameraPermissionStatus,
} from "expo-camera";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

/**
 * Standard dialogue enforcing user intervention when OS permission resets globally limit app capabilities.
 */
const showSettingsAlert = (title: string, message: string) => {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: "Open Settings", onPress: () => Linking.openSettings() },
  ]);
};

export const useAppPermissions = () => {
  const [cameraPermission, requestCamera] = useCameraPermissions();

  const requestCameraPermission = async (
    showPrompt = true,
  ): Promise<boolean> => {
    if (cameraPermission?.status === CameraPermissionStatus.GRANTED)
      return true;

    if (cameraPermission?.canAskAgain) {
      const response = await requestCamera();
      return response.granted;
    }

    if (showPrompt) {
      showSettingsAlert(
        "Camera Permission Needed",
        "Please enable camera permissions in settings to use scanning functionality.",
      );
    }
    return false;
  };

  const checkLocationPermission = async (
    showPrompt = true,
  ): Promise<boolean> => {
    const { status } = await Location.getForegroundPermissionsAsync();

    if (status === Location.PermissionStatus.GRANTED) return true;

    if (
      status === Location.PermissionStatus.UNDETERMINED ||
      status === Location.PermissionStatus.DENIED
    ) {
      const response = await Location.requestForegroundPermissionsAsync();
      if (response.status === Location.PermissionStatus.GRANTED) return true;
    }

    if (showPrompt) {
      showSettingsAlert(
        "Location Permission Needed",
        "Please enable location tracking to complete proximity-based requirements.",
      );
    }
    return false;
  };

  const checkNotificationPermission = async (
    showPrompt = true,
  ): Promise<boolean> => {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      if (showPrompt) {
        showSettingsAlert(
          "Notifications Disabled",
          "Please enable notifications to receive critical updates.",
        );
      }
      return false;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    return true;
  };

  return {
    cameraPermission,
    requestCameraPermission,
    checkLocationPermission,
    checkNotificationPermission,
  };
};
