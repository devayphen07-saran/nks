import { Platform, Dimensions } from "react-native";

export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";

export const getDeviceWidth = () => Dimensions.get("window").width;
export const getDeviceHeight = () => Dimensions.get("window").height;

export const isTablet = () => {
  const width = Math.min(getDeviceWidth(), getDeviceHeight());
  // Minimum dimension >= 600 generally indicates a tablet footprint.
  return width >= 600;
};
