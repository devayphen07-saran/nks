/**
 * PowerSync database instance — singleton for the entire app.
 *
 * Usage:
 *   import { powerSyncDb } from '@/lib/powersync-db';
 *
 *   // Query
 *   const rows = await powerSyncDb.getAll('SELECT * FROM routes WHERE deleted_at IS NULL');
 *
 *   // Write (always await assertWriteAllowed() before mutations — it is async)
 *   await assertWriteAllowed(['CASHIER', 'STORE_MANAGER', 'STORE_OWNER']);
 *   await powerSyncDb.execute('INSERT INTO routes ...', [...]);
 *
 * Connect after hydration:
 *   await powerSyncDb.connect(powerSyncConnector);
 *
 * Disconnect + wipe on revocation:
 *   await powerSyncDb.disconnectAndClear();
 */

import { PowerSyncDatabase } from "@powersync/react-native";
import { AppSchema } from "./powersync-schema";
import { createLogger } from "./logger";

const log = createLogger("PowerSyncDB");

export const powerSyncDb = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: "nks_offline.db",
  },
});

log.info("PowerSync database instance created (nks_offline.db)");
