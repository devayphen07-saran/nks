import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { getOrCreateDbKey } from '../../device/db-key';
import { createLogger } from '../../utils/logger';
import * as schema from '../schema';
import { DB_NAME } from './constants';
import { state, resetState } from './state';
import { validateEncryptionKey, applyEncryptionKey } from './encryption';
import { checkIntegrity, wipeCorruptedDatabase } from './integrity';
import { applyPragmas } from './pragmas';
import { runMigrations } from './migrations';

const log = createLogger('DatabaseConnection');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Opens and fully configures nks_offline.db.
 * Safe to call multiple times — returns the same in-flight promise to concurrent callers
 * and resolves immediately if already initialized.
 *
 * On corruption: wipes the database file, retries once automatically,
 * and sets wasWipedOnStartup() = true so the app can notify the user.
 */
export function initializeDatabase(): Promise<void> {
  if (state.isInitialized) return Promise.resolve();
  if (state.pendingInit)   return state.pendingInit;

  state.pendingInit = _runInit().catch((err) => {
    state.pendingInit = null; // allow a clean retry after failure
    throw err;
  });

  return state.pendingInit;
}

/**
 * Closes the database and resets all connection state.
 * Must be called on logout — prevents the next user on the same device
 * from inheriting an open connection with the previous user's encryption key.
 */
export async function closeDatabase(): Promise<void> {
  await state.rawSqlite?.closeAsync().catch(() => {});
  resetState();
  log.info('Database closed');
}

export function isDatabaseReady(): boolean {
  return state.isInitialized && state.drizzleDb !== null;
}

/**
 * Returns true if the database file was wiped due to corruption on this startup.
 * Check this after initializeDatabase() to show a data-loss recovery notice to the user.
 */
export function wasWipedOnStartup(): boolean {
  return state.wasWiped;
}

/** Drizzle ORM instance — use this for all queries via repositories. */
export function getDatabase(): ExpoSQLiteDatabase<typeof schema> {
  if (!state.drizzleDb) {
    throw new Error(
      'Database not initialized. Call initializeDatabase() first.',
    );
  }
  return state.drizzleDb;
}

// ─── Internals ────────────────────────────────────────────────────────────────

async function _runInit(): Promise<void> {
  // Validate key format before opening the file — avoids acquiring a handle
  // we would immediately have to close on a bad key.
  const encryptionKey = await getOrCreateDbKey();
  validateEncryptionKey(encryptionKey);

  try {
    await _openAndConfigure(encryptionKey);
  } catch (err) {
    if (state.wasWiped) {
      // Database was wiped due to corruption — retry once with a clean file.
      // All handles were already closed inside _openAndConfigure before the throw.
      log.warn('Retrying initialization after corruption wipe...');
      await _openAndConfigure(encryptionKey);
      return;
    }
    throw err;
  }
}

async function _openAndConfigure(encryptionKey: string): Promise<void> {
  try {
    // useNewConnection: true is REQUIRED — prevents expo-sqlite from returning
    // a cached connection that hasn't had PRAGMA key applied, which would cause
    // all reads to silently return garbage on an encrypted database.
    state.rawSqlite = await SQLite.openDatabaseAsync(DB_NAME, {
      useNewConnection: true,
    });

    await applyEncryptionKey(state.rawSqlite, encryptionKey);

    const isIntact = await checkIntegrity(state.rawSqlite);
    if (!isIntact) {
      await wipeCorruptedDatabase(state.rawSqlite);
      state.rawSqlite = null;
      state.wasWiped  = true;
      throw new Error('Database corrupted — wiped, will retry on next init call');
    }

    await applyPragmas(state.rawSqlite);

    state.drizzleDb = drizzle(state.rawSqlite, { schema });
    await runMigrations(state.drizzleDb as ExpoSQLiteDatabase<Record<string, unknown>>);

    state.isInitialized = true;
    log.info(`Database ready — ${DB_NAME}`);
  } catch (err) {
    // Close the raw handle to prevent a connection leak before allowing a retry
    await state.rawSqlite?.closeAsync().catch(() => {});
    state.rawSqlite = null;
    state.drizzleDb = null;
    log.error('Database initialization failed:', err);
    throw err;
  }
}
