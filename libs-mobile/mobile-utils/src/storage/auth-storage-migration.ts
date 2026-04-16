/**
 * One-time migration: moves user data from unencrypted AsyncStorage to
 * encrypted SecureStore.
 *
 * Background: Prior to this change, the user object (containing PII like
 * name, email, phone number) was stored in plain-text AsyncStorage. On
 * Android this data is accessible to rooted devices or apps with backup
 * access. SecureStore encrypts at rest using the hardware keychain.
 *
 * Call `migrateUserToSecureStore()` once during app initialization,
 * before the first `getUser()` call. It is safe to call repeatedly —
 * it no-ops when the AsyncStorage key is already empty.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveSecureItem } from "./secure-store";
import { AUTH_STORAGE_KEYS } from "./auth-storage";

/**
 * Migrates user data from AsyncStorage → SecureStore.
 *
 * Steps:
 *  1. Read `user` key from AsyncStorage
 *  2. If present, write to SecureStore (encrypted)
 *  3. Remove the unencrypted copy from AsyncStorage
 *
 * Errors are swallowed — if migration fails, the user will simply
 * need to re-authenticate on next app launch.
 *
 * @returns `true` if data was migrated, `false` if nothing to migrate
 */
export async function migrateUserToSecureStore(): Promise<boolean> {
  try {
    const oldUserData = await AsyncStorage.getItem(AUTH_STORAGE_KEYS.user);
    if (!oldUserData) return false;

    await saveSecureItem(AUTH_STORAGE_KEYS.user, oldUserData);
    await AsyncStorage.removeItem(AUTH_STORAGE_KEYS.user);
    return true;
  } catch {
    // Non-critical — SecureStore read will return null and user re-authenticates
    return false;
  }
}
