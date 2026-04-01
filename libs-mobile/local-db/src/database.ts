import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { schema } from "./schema";
import {
  AuthUser,
  AuthSession,
  AuthRoles,
  AuthFlags,
  PendingSync,
} from "./models";

let _db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (_db) return _db;

  const adapter = new SQLiteAdapter({
    dbName: "nks_mobile",
    schema,
    onSetUpError: (error: Error) => {
      console.error("Database setup error:", error);
    },
  });

  _db = new Database({
    adapter,
    modelClasses: [AuthUser, AuthSession, AuthRoles, AuthFlags, PendingSync],
  });

  return _db;
}

export function getDatabase(): Database {
  if (!_db) {
    throw new Error(
      "Database not initialized. Call initializeDatabase() first.",
    );
  }
  return _db;
}

export async function resetDatabase(): Promise<void> {
  if (!_db) return;

  await _db.write(async () => {
    const authUserRecords = await _db!.collections
      .get("auth_users")
      .query()
      .fetch();
    for (const record of authUserRecords) {
      await record.destroyPermanently();
    }

    const authSessionRecords = await _db!.collections
      .get("auth_sessions")
      .query()
      .fetch();
    for (const record of authSessionRecords) {
      await record.destroyPermanently();
    }

    const authRolesRecords = await _db!.collections
      .get("auth_roles")
      .query()
      .fetch();
    for (const record of authRolesRecords) {
      await record.destroyPermanently();
    }

    const authFlagsRecords = await _db!.collections
      .get("auth_flags")
      .query()
      .fetch();
    for (const record of authFlagsRecords) {
      await record.destroyPermanently();
    }

    const pendingSyncRecords = await _db!.collections
      .get("pending_sync")
      .query()
      .fetch();
    for (const record of pendingSyncRecords) {
      await record.destroyPermanently();
    }
  });
}

export async function getDatabaseStats() {
  if (!_db) return null;

  const db = _db;
  const allPendingSync = await db.collections
    .get("pending_sync")
    .query()
    .fetch();

  const stats = {
    pending: allPendingSync.filter((r: any) => r.status === "pending").length,
    inProgress: allPendingSync.filter((r: any) => r.status === "in_progress")
      .length,
    synced: allPendingSync.filter((r: any) => r.status === "synced").length,
    failed: allPendingSync.filter((r: any) => r.status === "failed").length,
    quarantined: allPendingSync.filter((r: any) => r.status === "quarantined")
      .length,
    total: allPendingSync.length,
  };

  return stats;
}
