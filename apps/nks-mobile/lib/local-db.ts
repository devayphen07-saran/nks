/**
 * Local SQLite Database — expo-sqlite with SQLCipher encryption.
 *
 * Lightweight encrypted SQLite implementation for offline-first sync.
 * Manages three tables:
 *   - routes:         Synced navigation routes (from backend GET /sync/changes)
 *   - sync_state:     Cursor tracking (key='cursor', value=millisecond epoch)
 *   - mutation_queue: Pending mutations awaiting push to backend
 *
 * All data is encrypted using SQLCipher via SecureStore-managed keys.
 *
 * Usage:
 *   import { getCursor, saveCursor, queueMutation } from './local-db';
 *   import { initializeDatabase } from './local-db';
 *
 *   // Initialize on app startup
 *   await initializeDatabase();
 *
 *   // Get last sync cursor
 *   const cursor = getCursor();
 *
 *   // Save new cursor after pull
 *   saveCursor(Date.now());
 *
 *   // Queue a mutation for push
 *   queueMutation('PUT', 'routes', { id: 1, routeName: 'Home' });
 */

import * as SQLite from "expo-sqlite";
import { getOrCreateDbKey } from "./db-key";
import { createLogger } from "./logger";

const log = createLogger("LocalDB");

let _db: SQLite.SQLiteDatabase | null = null;
let _dbInitialized = false;

/**
 * Initialize the encrypted SQLite database.
 * Sets up encryption key and creates tables if they do not exist.
 * Safe to call multiple times — returns on first call.
 *
 * Must be called before any other database operations.
 */
export async function initializeDatabase(): Promise<void> {
  if (_dbInitialized) {
    log.debug("Database already initialized");
    return;
  }

  try {
    // Get or create the encryption key
    const encryptionKey = await getOrCreateDbKey();

    // Open the database with SQLCipher
    _db = await SQLite.openDatabaseAsync("nks_offline.db", {
      useNewConnection: true,
    });

    if (!_db) {
      throw new Error("Failed to open database");
    }

    log.info("Local encrypted database opened: nks_offline.db");

    // Validate encryption key format before use (64 hex chars = 32 bytes)
    if (!/^[0-9a-f]{64}$/i.test(encryptionKey)) {
      throw new Error('Invalid encryption key format — expected 64-char hex string');
    }

    // CRITICAL: Set encryption key FIRST before any other operations
    await _db.execAsync(`PRAGMA key = '${encryptionKey}'`);

    // Verify integrity
    const integrityResult = await _db.getFirstAsync<{ integrity_check: string }>(
      "PRAGMA integrity_check",
    );

    if (integrityResult?.integrity_check !== "ok") {
      throw new Error(
        `Database integrity check failed: ${integrityResult?.integrity_check}`,
      );
    }

    // Enable WAL mode for better concurrency
    await _db.execAsync("PRAGMA journal_mode = WAL");

    // Create sync_state table (key-value store for cursor)
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Create routes table (mirrors backend routes schema)
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS routes (
        id INTEGER PRIMARY KEY,
        guuid TEXT NOT NULL UNIQUE,
        parent_route_fk INTEGER,
        route_name TEXT NOT NULL,
        route_path TEXT NOT NULL,
        full_path TEXT NOT NULL,
        description TEXT,
        icon_name TEXT,
        route_type TEXT NOT NULL,
        route_scope TEXT NOT NULL,
        is_public INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )
    `);

    // Index for efficient sorting/queries
    await _db.execAsync(`
      CREATE INDEX IF NOT EXISTS routes_updated_at_idx
      ON routes (updated_at DESC)
    `);

    // Create mutation_queue table (pending mutations for POST /sync/push)
    await _db.execAsync(`
      CREATE TABLE IF NOT EXISTS mutation_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        entity TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        retries INTEGER NOT NULL DEFAULT 0
      )
    `);

    _dbInitialized = true;
    log.info("Database tables initialized with SQLCipher encryption");
  } catch (err) {
    log.error("Database initialization failed:", err);
    throw err;
  }
}

/**
 * Get the initialized database instance.
 * Throws if database has not been initialized.
 */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first.",
    );
  }
  return _db;
}

/**
 * Retrieve the last sync cursor from sync_state table.
 * Returns 0 if no cursor is stored (first sync).
 */
export async function getCursor(): Promise<number> {
  try {
    const db = getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_state WHERE key = ?",
      ["cursor"],
    );

    return row ? parseInt(row.value, 10) : 0;
  } catch (err) {
    log.error("Failed to get cursor:", err);
    return 0;
  }
}

/**
 * Save a new sync cursor to sync_state table.
 * Overwrites any existing cursor.
 */
export async function saveCursor(cursorMs: number): Promise<void> {
  try {
    const db = getDatabase();

    // DELETE then INSERT to ensure single row
    await db.runAsync("DELETE FROM sync_state WHERE key = ?", ["cursor"]);
    await db.runAsync(
      "INSERT INTO sync_state (key, value) VALUES (?, ?)",
      ["cursor", String(cursorMs)],
    );

    log.debug(`Cursor saved: ${cursorMs}`);
  } catch (err) {
    log.error("Failed to save cursor:", err);
  }
}

/**
 * Queue a mutation for push to backend.
 * Stores operation, entity name, and JSON payload.
 *
 * @param operation 'PUT' | 'PATCH' | 'DELETE'
 * @param entity Table name (e.g., 'routes', 'products')
 * @param payload Mutation data as object
 */
export async function queueMutation(
  operation: string,
  entity: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDatabase();
    const now = Date.now();
    const payloadJson = JSON.stringify(payload);

    await db.runAsync(
      `
      INSERT INTO mutation_queue (operation, entity, payload, created_at, retries)
      VALUES (?, ?, ?, ?, ?)
      `,
      [operation, entity, payloadJson, now, 0],
    );

    log.debug(`Mutation queued: ${operation} ${entity}`);
  } catch (err) {
    log.error("Failed to queue mutation:", err);
  }
}

/**
 * Fetch the oldest pending mutations from the queue.
 * Used by sync-engine to batch push operations to the backend.
 *
 * @param limit Number of rows to fetch (default 50)
 */
interface MutationQueueRow {
  id: number;
  operation: string;
  entity: string;
  payload: string;
  retries: number;
}

export async function getMutationQueueBatch(
  limit: number = 50,
): Promise<
  Array<{
    id: number;
    operation: string;
    entity: string;
    payload: Record<string, unknown>;
    retries: number;
  }>
> {
  try {
    const db = getDatabase();
    const rows = await db.getAllAsync<MutationQueueRow>(
      `
      SELECT id, operation, entity, payload, retries
      FROM mutation_queue
      ORDER BY id ASC
      LIMIT ?
      `,
      [limit],
    );

    if (!rows || rows.length === 0) {
      return [];
    }

    return rows.map((row: MutationQueueRow) => ({
      id: row.id,
      operation: row.operation,
      entity: row.entity,
      payload: JSON.parse(row.payload),
      retries: row.retries,
    }));
  } catch (err) {
    log.error("Failed to fetch mutation batch:", err);
    return [];
  }
}

/**
 * Remove mutations from the queue after successful push.
 * @param ids Array of mutation IDs to delete
 */
export async function deleteMutationsById(ids: number[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    const db = getDatabase();
    const placeholders = ids.map(() => "?").join(",");
    await db.runAsync(
      `DELETE FROM mutation_queue WHERE id IN (${placeholders})`,
      ids,
    );

    log.debug(`Deleted ${ids.length} mutations from queue`);
  } catch (err) {
    log.error("Failed to delete mutations:", err);
  }
}

/**
 * Increment retry count for a mutation.
 * Used when a push attempt fails.
 *
 * @param id Mutation ID
 */
export async function incrementMutationRetry(id: number): Promise<void> {
  try {
    const db = getDatabase();
    await db.runAsync(
      "UPDATE mutation_queue SET retries = retries + 1 WHERE id = ?",
      [id],
    );

    log.debug(`Retry count incremented for mutation ${id}`);
  } catch (err) {
    log.error("Failed to increment retry count:", err);
  }
}

/**
 * Clear all data from the local database.
 * Called on logout or remote wipe.
 */
export async function clearAllTables(): Promise<void> {
  try {
    const db = getDatabase();
    await db.runAsync("DELETE FROM routes");
    await db.runAsync("DELETE FROM sync_state");
    await db.runAsync("DELETE FROM mutation_queue");

    log.info("All tables cleared");
  } catch (err) {
    log.error("Failed to clear tables:", err);
  }
}
