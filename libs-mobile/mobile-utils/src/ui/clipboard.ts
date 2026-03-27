import * as Clipboard from "expo-clipboard";
import { Platform, ToastAndroid } from "react-native";
import { hapticLightImpact } from "../device/haptics";

/**
 * Copies a string directly to the native OS clipboard buffer.
 * Plays a tiny UX haptic pulse on iOS, or an actual native Toast on Android
 * so the user knows an action silently succeeded.
 */
export const copyToClipboard = async (text: string, showFeedback = true) => {
  await Clipboard.setStringAsync(text);

  if (showFeedback) {
    if (Platform.OS === "android") {
      ToastAndroid.show("Copied to clipboard", ToastAndroid.SHORT);
    } else {
      hapticLightImpact();
    }
  }
};

/**
 * Reads the latest string out of the native OS clipboard buffer.
 */
export const readFromClipboard = async (): Promise<string> => {
  return await Clipboard.getStringAsync();
};
