/**
 * @deprecated Import directly from './database' instead.
 * This file exists only for backward-compatibility with existing imports.
 */

// ─── Connection ───────────────────────────────────────────────────────────────
export { initializeDatabase, closeDatabase, getDatabase, isDatabaseReady, wasWipedOnStartup } from './database';

// ─── Repositories ─────────────────────────────────────────────────────────────
export {
  syncStateRepository,
  mutationQueueRepository,
  stateRepository,
  districtRepository,
} from './database';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStateRow,
  MutationQueueRow,
  MutationQueueItem,
  StateRow,
  DistrictRow,
} from './database';

// ─── clearAllTables (used by reconnection-handler + logout-thunk) ─────────────
import { isDatabaseReady } from './database';
import {
  syncStateRepository as _ss,
  mutationQueueRepository as _mq,
  mutationQueueLogRepository as _mqLog,
  stateRepository as _state,
  districtRepository as _district,
  lookupRepository as _lookup,
  storesRepository as _stores,
  stagingRepository as _staging,
  storeCacheRepository as _storeCache,
  storeSyncProgressRepository as _storeProgress,
  syncMetadataRepository as _syncMeta,
  rolesRepository as _roles,
  permissionConstraintsRepository as _permConstraints,
} from './database/repositories';
import { failedOperationsRepository as _failedOps } from './database/repositories/failed-operations.repository';
import { createLogger } from './utils/logger';

const log = createLogger('LocalDB');

/**
 * Wipe every per-user table in the local DB. Called on logout, remote wipe
 * (token theft), and full rebootstrap.
 *
 * Sequential, child-tables-first. The `stores` table is the FK parent of
 * many others (cascade ON DELETE), but we delete children explicitly anyway
 * — relying on cascade as the primary mechanism would silently mask a
 * future schema change that drops a foreign key.
 *
 * Not transactional: each repo's clear() opens its own write, and rewriting
 * 14 repos to accept a tx handle is invasive. A partial wipe is recovered by
 * the call-site's safety net (logout deletes the encryption key; remote wipe
 * also clears tokens; rebootstrap pulls fresh data).
 *
 * NOT cleared (intentional): nothing — the `stores` table is wiped on
 * logout because it holds the catalog of stores tied to the previous user's
 * roles. The replicator repopulates it on next login.
 */
export async function clearAllTables(): Promise<void> {
  if (!isDatabaseReady()) {
    log.info('Database not initialized — skipping table clear');
    return;
  }
  try {
    // Sync infra (no FK to stores)
    await _mqLog.clear();
    await _failedOps.clear();
    await _mq.clear();
    await _ss.clear();

    // Per-store reference / sync state (FK → stores, cascade)
    await _staging.clear();
    await _storeCache.clear();
    await _syncMeta.clear();
    await _storeProgress.clear();
    await _permConstraints.clear();
    await _roles.clear(); // wipes roles + permissions + role_permissions + user_store_roles

    // Lookup / location (no FK to stores)
    await _state.clear();
    await _district.clear();
    await _lookup.clear();

    // Parent last
    await _stores.clear();

    log.info('All tables cleared');
  } catch (err) {
    log.error('Failed to clear tables:', err);
  }
}
