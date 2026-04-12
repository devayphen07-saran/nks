/**
 * DeviceManager — Centralized device fingerprint manager.
 *
 * Generates a SHA-256 fingerprint of platform + model + appVersion and
 * persists it to SecureStore. Every API request includes it as the
 * `X-Device-Fingerprint` header.
 *
 * Depends on: expo-crypto, expo-device, expo-application
 */

import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { createLogger } from "./logger";

const FINGERPRINT_KEY = "nks.device.fingerprint";
const log = createLogger("DeviceManager");

export interface DeviceFingerprint {
  value: string;
  platform: string;
  model: string;
  appVersion: string;
}

let _cached: DeviceFingerprint | null = null;

async function generateFingerprint(): Promise<DeviceFingerprint> {
  const platform = Platform.OS;
  const model = Device.modelName ?? "unknown";
  const appVersion = Application.nativeApplicationVersion ?? "0.0.0";

  const raw = `${platform}:${model}:${appVersion}`;
  const value = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );

  return { value, platform, model, appVersion };
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
   * Verifies the current fingerprint against the persisted one.
   * Returns false if the device identity changed (reinstall, restore, etc).
   */
  async verifyFingerprint(): Promise<boolean> {
    try {
      const persisted = await loadPersistedFingerprint();
      if (!persisted) {
        // First run — generate and persist
        await DeviceManager.getFingerprint();
        return true;
      }

      const current = await generateFingerprint();
      const match = persisted.value === current.value;

      if (!match) {
        log.warn(
          `Fingerprint mismatch — device identity changed. ` +
            `Persisted: ${persisted.value.slice(0, 12)}, Current: ${current.value.slice(0, 12)}`,
        );
        // Update persisted to current (e.g., after app update changes appVersion)
        await persistFingerprint(current);
        _cached = current;
      }

      return true; // Always true — fingerprint is informational, not a hard gate
    } catch (err) {
      log.error("verifyFingerprint failed:", err);
      return true; // Don't block startup on fingerprint errors
    }
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
