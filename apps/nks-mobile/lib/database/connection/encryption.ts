import type * as SQLite from 'expo-sqlite';
import { ENCRYPTION_KEY_REGEX } from './constants';

/**
 * Throws if the key is not a valid 64-char hex string (32 bytes).
 * Must be called BEFORE opening the database to avoid acquiring a
 * file handle that immediately has to be closed on a bad key.
 */
export function validateEncryptionKey(key: string): void {
  if (!ENCRYPTION_KEY_REGEX.test(key)) {
    throw new Error(
      'Invalid encryption key format — expected 64-char hex string',
    );
  }
}

/**
 * Applies the encryption key to the open database connection.
 * PRAGMA key must be the first SQL statement on an encrypted database —
 * executing any other statement first causes all reads to return garbage.
 */
export async function applyEncryptionKey(
  db: SQLite.SQLiteDatabase,
  key: string,
): Promise<void> {
  // Re-validate here as a defence-in-depth guard before interpolating into SQL.
  // validateEncryptionKey() must also be called before opening the DB, but this
  // ensures no path can bypass the check and reach the PRAGMA statement with an
  // arbitrary string.
  if (!ENCRYPTION_KEY_REGEX.test(key)) {
    throw new Error('applyEncryptionKey: key failed validation guard');
  }
  // Use SQLCipher hex literal syntax x'...' so the 32 raw bytes are passed
  // directly rather than being hashed as a passphrase. The key is guaranteed
  // to be a 64-char hex string by the validation above.
  const pragma = ['PRAGMA key = "x', key, '"'].join("'");
  await db.execAsync(pragma);
}
