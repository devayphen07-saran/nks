import { Linking, Platform } from "react-native";

/**
 * Throws the phone number immediately into the native OS dialer
 * fully prepared to initiate a GSM call.
 */
export const openPhoneDialer = (phoneNumber: string) => {
  Linking.openURL(`tel:${phoneNumber}`).catch((err) =>
    console.warn("Failed to open phone dialer.", err)
  );
};

/**
 * Spawns the native iOS Mail app or Android Gmail client
 * with an optional pre-filled Subject line.
 */
export const openEmailApp = (email: string, subject = "") => {
  let url = `mailto:${email}`;
  if (subject) url += `?subject=${encodeURIComponent(subject)}`;
  Linking.openURL(url).catch((err) =>
    console.warn("Failed to open email app.", err)
  );
};

/**
 * Triggers the native geographic mapping architecture.
 * iOS -> Apple Maps
 * Android -> Google Maps natively
 * Fallback -> Web Google Maps
 */
export const openMapsApp = (address: string) => {
  const encodedAddress = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps://app?q=${encodedAddress}`,
    android: `google.navigation:q=${encodedAddress}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
  });
  
  if (url) {
    Linking.openURL(url).catch((err) =>
      console.warn("Failed to jump into mapping software.", err)
    );
  }
};
