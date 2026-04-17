import type * as SQLite from 'expo-sqlite';

/**
 * Applies all performance and correctness PRAGMAs in a single round-trip.
 *
 * busy_timeout  — wait up to 5s instead of failing immediately on SQLITE_BUSY
 *                 (prevents errors when sync engine reads and mutation queue writes concurrently)
 * journal_mode  — WAL: readers don't block writers, better mobile concurrency
 * synchronous   — NORMAL: safe with WAL, ~10x faster writes than FULL
 * foreign_keys  — enforce FK constraints (SQLite disables them by default)
 */
export async function applyPragmas(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA busy_timeout  = 5000;
    PRAGMA journal_mode  = WAL;
    PRAGMA synchronous   = NORMAL;
    PRAGMA foreign_keys  = ON;
  `);
}
