/**
 * Device Binding / Session Pinning
 * Binds authentication tokens to device identity to prevent token theft exploitation.
 * Uses Expo-compatible modules — works in both Expo Go and development builds.
 */

import { Platform } from "react-native";
import * as crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Application from "expo-application";
import { createLogger } from "../utils/logger";

const log = createLogger("DeviceBinding");

const DEVICE_BINDING_SECRET = process.env["EXPO_PUBLIC_DEVICE_BINDING_SECRET"] ?? "";
if (!DEVICE_BINDING_SECRET) {
  if (__DEV__) {
    log.warn("DEVICE_BINDING_SECRET is not set — HMAC tamper detection is disabled");
  } else {
    // Hard fail in production — shipping without a binding secret means token
    // binding provides no protection. Set DEVICE_BINDING_SECRET in your .env.
    throw new Error("[DeviceBinding] DEVICE_BINDING_SECRET must be set in production builds");
  }
}

export interface DeviceIdentity {
  deviceId: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  timestamp: number;
  hash: string;
  signature: string;
}

/**
 * Returns a stable device identifier.
 * iOS: Vendor ID (persists across reinstalls on same device).
 * Android: Android ID (hardware-level, persists across reinstalls).
 */
export async function getStableDeviceId(): Promise<string> {
  if (Platform.OS === "ios") {
    const vendorId = await Application.getIosIdForVendorAsync();
    return vendorId ?? "unknown-ios";
  }

  if (Platform.OS === "android") {
    return Application.getAndroidId() ?? "unknown-android";
  }

  return "unknown";
}

/**
 * Gets device identity for token binding.
 * Uses expo-device and expo-application (works in Expo Go).
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  const deviceId = await getStableDeviceId();
  const deviceModel = Device.modelName ?? "unknown";
  const osVersion = Device.osVersion ?? "unknown";
  const appVersion = Application.nativeApplicationVersion ?? "0.0.0";

  // Only use stable identifiers in hash — osVersion and appVersion are intentionally excluded:
  // - osVersion changes on every system update → would invalidate binding after OS update
  // - appVersion changes on every app release → would log out all users after each deploy
  // deviceId (iOS vendor ID / Android ID) and deviceModel are stable for the device's lifetime
  const hashInput = `${deviceId}:${deviceModel}`;
  const hash = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    hashInput,
  );

  // NOTE: Client-side HMAC is a UX guard, not a cryptographic security boundary.
  // The secret is baked into the app bundle at build time and can be extracted.
  // For true device attestation use Apple DeviceCheck / Google Play Integrity.
  const signatureInput = hash;
  const signatureBase = `${DEVICE_BINDING_SECRET}:${signatureInput}`;
  const signature = await crypto.digestStringAsync(
    crypto.CryptoDigestAlgorithm.SHA256,
    signatureBase,
  );

  return {
    deviceId,
    deviceModel,
    osVersion,
    appVersion,
    timestamp: Date.now(),
    hash,
    signature,
  };
}

/**
 * Formats device identity for sending in API requests.
 * Server uses this to validate token requests come from expected device.
 */
export function formatDeviceBindingForRequest(
  identity: DeviceIdentity,
): Record<string, string | number> {
  return {
    deviceId: identity.deviceId,
    deviceModel: identity.deviceModel,
    osVersion: identity.osVersion,
    appVersion: identity.appVersion,
    hash: identity.hash,
    signature: identity.signature,
  };
}

