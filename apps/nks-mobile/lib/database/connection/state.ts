import type * as SQLite from 'expo-sqlite';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type * as schema from '../schema';

export interface ConnectionState {
  rawSqlite:     SQLite.SQLiteDatabase | null;
  drizzleDb:     ExpoSQLiteDatabase<typeof schema> | null;
  isInitialized: boolean;
  pendingInit:   Promise<void> | null;
  wasWiped:      boolean;
}

export const state: ConnectionState = {
  rawSqlite:     null,
  drizzleDb:     null,
  isInitialized: false,
  pendingInit:   null,
  wasWiped:      false,
};

export function resetState(): void {
  state.rawSqlite     = null;
  state.drizzleDb     = null;
  state.isInitialized = false;
  state.pendingInit   = null;
  state.wasWiped      = false;
}
