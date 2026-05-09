import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import Constants from 'expo-constants';
import { getOrCreateDbKey } from '../../device/db-key';
import { createLogger } from '../../utils/logger';
import * as schema from '../schema';
import { DB_NAME } from './constants';
import { state, resetState } from './state';
import { validateEncryptionKey, applyEncryptionKey } from './encryption';
import { checkIntegrity, wipeCorruptedDatabase } from './integrity';
import { applyPragmas } from './pragmas';
import { runMigrations } from './migrations';

// Expo Go does not ship SQLCipher — encryption must be skipped to avoid SIGSEGV.
// Dev builds and release builds include SQLCipher and run with a real key.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

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
  // Expo Go does not include SQLCipher — skip encryption to avoid SIGSEGV.
  // Dev builds and production builds include SQLCipher and use a real key.
  let encryptionKey: string | null = null;
  if (!IS_EXPO_GO) {
    encryptionKey = await getOrCreateDbKey();
    validateEncryptionKey(encryptionKey);
  }

  try {
    await _openAndConfigure(encryptionKey);
  } catch (err) {
    if (state.wasWiped || _isMigrationError(err)) {
      if (!state.wasWiped) {
        await state.rawSqlite?.closeAsync().catch(() => {});
        await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {});
        state.rawSqlite = null;
        state.drizzleDb = null;
        log.warn('Migration failed — wiping database and retrying with clean file');
      } else {
        log.warn('Retrying initialization after corruption wipe...');
      }
      await _openAndConfigure(encryptionKey);
      return;
    }
    throw err;
  }
}

/** Returns true when the error is a Drizzle migration failure (table already exists etc.) */
function _isMigrationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('Failed to run the query') ||
    msg.includes('already exists') ||
    msg.includes('no such table') ||
    msg.includes('SQLITE_ERROR') ||
    msg.includes('Migration')
  );
}

async function _openAndConfigure(encryptionKey: string | null): Promise<void> {
  try {
    state.rawSqlite = await SQLite.openDatabaseAsync(
      DB_NAME,
      IS_EXPO_GO ? undefined : { useNewConnection: true },
    );

    if (encryptionKey) {
      await applyEncryptionKey(state.rawSqlite, encryptionKey);
    }

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
    await state.rawSqlite?.closeAsync().catch(() => {});
    state.rawSqlite = null;
    state.drizzleDb = null;
    log.error('Database initialization failed:', err);
    throw err;
  }
}
