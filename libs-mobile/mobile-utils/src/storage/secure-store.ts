import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Cached result of the SecureStore availability check.
 * Resolved once on first use — the result never changes at runtime.
 */
let _available: boolean | null = null;

/**
 * Returns whether expo-secure-store is available on this device.
 * Web always returns false; native devices check the hardware keychain.
 * Result is cached after the first call.
 */
const isAvailable = async (): Promise<boolean> => {
  if (_available === null) {
    _available =
      Platform.OS !== "web" ? await SecureStore.isAvailableAsync() : false;
  }
  return _available;
};

/**
 * Saves a string value to the device keychain (native) or AsyncStorage (web).
 * Web keys are prefixed with `secure_` to avoid collisions with non-secure storage.
 */
export const saveSecureItem = async (
  key: string,
  value: string,
): Promise<void> => {
  if (await isAvailable()) {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(`secure_${key}`, value);
  }
};

/**
 * Retrieves a string value from the device keychain (native) or AsyncStorage (web).
 * Returns null if the key does not exist.
 */
export const getSecureItem = async (key: string): Promise<string | null> => {
  if (await isAvailable()) {
    return SecureStore.getItemAsync(key);
  }
  return AsyncStorage.getItem(`secure_${key}`);
};

/**
 * Deletes a value from the device keychain (native) or AsyncStorage (web).
 */
export const deleteSecureItem = async (key: string): Promise<void> => {
  if (await isAvailable()) {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(`secure_${key}`);
  }
};
