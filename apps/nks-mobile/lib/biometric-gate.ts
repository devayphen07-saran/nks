/**
 * Biometric gate — wraps any action behind a biometric (or device passcode) prompt.
 *
 * Usage:
 *   // Gate a sensitive operation
 *   const result = await withBiometricGate(
 *     () => deleteAccount(userId),
 *     'Confirm account deletion',
 *   );
 *
 *   // Check availability without prompting
 *   const available = await isBiometricAvailable();
 */

import * as LocalAuthentication from "expo-local-authentication";
import { createLogger } from "./logger";

const log = createLogger("BiometricGate");

class BiometricAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BiometricAuthError";
  }
}

/**
 * Returns true if the device has biometric hardware that is enrolled.
 * Falls back gracefully when hardware is absent.
 */
async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

/**
 * Prompts the user with biometric (or device passcode) authentication,
 * then executes `action` if successful.
 *
 * @param action   - The sensitive operation to run after auth succeeds
 * @param prompt   - The reason string shown in the biometric dialog
 * @returns The result of `action`
 * @throws {BiometricAuthError} if authentication fails or is cancelled
 */
export async function withBiometricGate<T>(
  action: () => Promise<T>,
  prompt = "Authenticate to continue",
): Promise<T> {
  const available = await isBiometricAvailable();

  if (!available) {
    // No biometrics enrolled — fall back to device passcode
    log.info("No biometrics enrolled — falling back to passcode");
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    fallbackLabel: "Use Passcode",
    cancelLabel: "Cancel",
    // Allow device passcode as fallback when biometrics are unavailable/failed
    disableDeviceFallback: false,
  });

  if (!result.success) {
    const reason =
      "error" in result
        ? (result as { error: string }).error
        : "cancelled";
    log.warn(`Biometric auth failed: ${reason}`);
    throw new BiometricAuthError(`Authentication failed: ${reason}`);
  }

  log.info("Biometric auth succeeded");
  return action();
}
