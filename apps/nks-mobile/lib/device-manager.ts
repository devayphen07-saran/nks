/**
 * DeviceManager — Centralized device fingerprint manager.
 *
 * Generates a SHA-256 fingerprint of platform + model + appVersion and
 * persists it to SecureStore. Every API request includes it as the
 * `X-Device-Fingerprint` header.
 *
 * Depends on: expo-crypto, expo-device, expo-application
 */

import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { createLogger } from "./logger";
import { STORAGE_KEYS } from "./storage-keys";
import { getStableDeviceId } from "./device-binding";

const FINGERPRINT_KEY = STORAGE_KEYS.DEVICE_FINGERPRINT;
const log = createLogger("DeviceManager");

export interface DeviceFingerprint {
  value: string;
  platform: string;
  model: string;
  appVersion: string;
}

let _cached: DeviceFingerprint | null = null;

async function generateFingerprint(): Promise<DeviceFingerprint> {
  const deviceId = await getStableDeviceId();
  const model = Device.modelName ?? "unknown";
  const appVersion = Application.nativeApplicationVersion ?? "0.0.0";

  const raw = `${deviceId}:${model}:${appVersion}`;
  const value = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );

  return { value, platform: deviceId, model, appVersion };
}

async function persistFingerprint(fp: DeviceFingerprint): Promise<void> {
  await SecureStore.setItemAsync(FINGERPRINT_KEY, JSON.stringify(fp));
}

async function loadPersistedFingerprint(): Promise<DeviceFingerprint | null> {
  try {
    const raw = await SecureStore.getItemAsync(FINGERPRINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceFingerprint;
  } catch {
    return null;
  }
}

export const DeviceManager = {
  /**
   * Returns the current device fingerprint (generates + persists on first call).
   * Subsequent calls return the in-memory cached value.
   */
  async getFingerprint(): Promise<DeviceFingerprint> {
    if (_cached) return _cached;

    // Try persisted first — avoids regeneration across app restarts
    const persisted = await loadPersistedFingerprint();
    if (persisted) {
      _cached = persisted;
      return persisted;
    }

    const fp = await generateFingerprint();
    await persistFingerprint(fp);
    _cached = fp;
    log.info(`Generated fingerprint: ${fp.value.slice(0, 12)}...`);
    return fp;
  },

  /**
   * Returns the fingerprint value string for use in request headers.
   * Calls getFingerprint() internally — safe to call at any time.
   */
  async getHeaderValue(): Promise<string> {
    const fp = await DeviceManager.getFingerprint();
    return fp.value;
  },

  /**
   * Clears the persisted fingerprint (call on logout / device wipe).
   */
  async clear(): Promise<void> {
    _cached = null;
    await SecureStore.deleteItemAsync(FINGERPRINT_KEY).catch(() => {});
  },
};
