/**
 * Database Encryption Key Management
 *
 * Manages the SQLCipher encryption key using SecureStore.
 * Key is generated once on first launch and persisted securely.
 * Retrieved on subsequent launches.
 *
 * Usage:
 *   const key = await getOrCreateDbKey();
 *   // Use key with PRAGMA key in local-db.ts
 *
 *   // On logout (for shared devices):
 *   await deleteDbKey();
 */

import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { createLogger } from "../utils/logger";

const log = createLogger("DbKey");

const DB_KEY_STORAGE_KEY = "nks.db.encryption_key";

/**
 * Generate a 32-byte random key and return as hex string.
 */
async function generateNewKey(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytes(32);
  // Convert byte array to hex string
  const hex = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

/**
 * Get or create the database encryption key.
 * On first call, generates a new key and stores it in SecureStore.
 * On subsequent calls, retrieves the existing key.
 *
 * @returns Encryption key as hex string (64 characters for 32 bytes)
 * @throws If key generation or storage fails
 */
export async function getOrCreateDbKey(): Promise<string> {
  try {
    // Try to retrieve existing key
    const existingKey = await SecureStore.getItemAsync(DB_KEY_STORAGE_KEY);

    if (existingKey) {
      log.debug("Using existing database encryption key");
      return existingKey;
    }

    // Generate new key
    const newKey = await generateNewKey();

    // Store in SecureStore with maximum security
    await SecureStore.setItemAsync(DB_KEY_STORAGE_KEY, newKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });

    log.info("Generated and stored new database encryption key");
    return newKey;
  } catch (err) {
    log.error("Failed to get or create database key:", err);
    throw err;
  }
}

/**
 * Delete the database encryption key from SecureStore.
 * Used on logout for shared devices to ensure key is not reused.
 *
 * @throws If key deletion fails
 */
export async function deleteDbKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DB_KEY_STORAGE_KEY);
    log.info("Database encryption key deleted");
  } catch (err) {
    log.error("Failed to delete database key:", err);
    throw err;
  }
}
