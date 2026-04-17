import * as SQLite from 'expo-sqlite';
import { createLogger } from '../../utils/logger';
import { DB_NAME } from './constants';

const log = createLogger('DatabaseIntegrity');

/**
 * Runs SQLite's built-in integrity check.
 * Returns true if the database is healthy, false if corrupted.
 */
export async function checkIntegrity(
  db: SQLite.SQLiteDatabase,
): Promise<boolean> {
  const result = await db.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check',
  );
  return result?.integrity_check === 'ok';
}

/**
 * Closes the corrupted database handle and deletes the file.
 * The next call to initializeDatabase() will create a fresh database.
 */
export async function wipeCorruptedDatabase(
  db: SQLite.SQLiteDatabase,
): Promise<void> {
  log.error('Integrity check failed — wiping corrupted database');
  await db.closeAsync().catch(() => {});
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
