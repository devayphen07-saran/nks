/**
 * Store selection — switching the active store from the store-picker UI.
 *
 * Single entry point: selectStore(...). Caller is the store-list screen.
 *
 * Rules enforced here:
 *   1. Must be online — switching while offline can leave the user with a
 *      half-replicated store and no way to finish.
 *   2. Only one replication may run at a time across the app.
 *   3. If the target store has fresh cached data, skip the network and just
 *      flip the active store. Otherwise replicate first, then flip.
 *   4. Redux activeStore is updated only after replication succeeds, so the
 *      UI never points at a store whose local data is incomplete.
 *   5. Crash recovery: if the new store's replication fails, the partially-
 *      pulled rows are wiped so the user remains cleanly on the old store.
 *      The old store's data is kept untouched until the new store's pull
 *      has fully completed; only then are the old store's rows cleared.
 *
 * Errors thrown are explicit and named so the UI can map them to messages.
 */

import type { AppDispatch } from '../../store';
import { storesRepository } from '../database/repositories/stores.repository';
import { storeCacheRepository } from '../database/repositories/store-cache.repository';
import { networkMonitor } from '../sync/network-monitor';
import { storeReplicator } from '../sync/store-replicator';
import { setActiveStoreByGuuid } from './active-store';
import { clearStoreScopedData } from './clear-store-scoped-data';
import { switchActiveStoreOnServer } from './switch-active-store';
import { createLogger } from '../utils/logger';

const log = createLogger('SelectStore');

// ─── Errors ────────────────────────────────────────────────────────────────

export class OfflineCannotSwitchStoreError extends Error {
  constructor() {
    super('Cannot switch stores while offline');
    this.name = 'OfflineCannotSwitchStoreError';
  }
}

export class StoreSyncInProgressError extends Error {
  constructor() {
    super('Another store is currently syncing — please wait');
    this.name = 'StoreSyncInProgressError';
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface SelectStoreInput {
  storeId:    number;
  storeGuuid: string;
  storeName:  string;
  dispatch:   AppDispatch;
  /**
   * Guuid of the store the user is switching FROM. Null on the very first
   * activation after login. Used to clean up the old store's data only
   * after the new store has fully replicated and become active.
   */
  previousStoreGuuid: string | null;
  /** Called with progress updates during replication. Optional. */
  onStatusChange?: (status: 'cached' | 'replicating' | 'done') => void;
}

export async function selectStore(input: SelectStoreInput): Promise<void> {
  const { storeId, storeGuuid, storeName, onStatusChange } = input;

  if (!networkMonitor.isOnline()) {
    throw new OfflineCannotSwitchStoreError();
  }

  if (storeReplicator.isAnyReplicating()) {
    throw new StoreSyncInProgressError();
  }

  // Bind the session to the new store on the backend BEFORE any pull happens.
  // POST /auth/switch-store atomically updates session.active_store_fk and
  // upserts device_registration for (deviceId, userId, newStoreId) in one
  // transaction. Without this, /sync/pull?storeId=B returns 403 because
  // DeviceAuthGuard cannot find a registration row for the new store.
  await switchActiveStoreOnServer(storeId);

  const cached = await storeCacheRepository.getFresh(storeId);
  if (cached) {
    log.info(`Using cached data for store ${storeId} (${storeName})`);
    onStatusChange?.('cached');
    await activateStore(input);
    onStatusChange?.('done');
    return;
  }

  log.info(`Replicating store ${storeId} (${storeName}) before activation`);
  onStatusChange?.('replicating');

  try {
    await storeReplicator.replicateStore(storeId, storeGuuid, storeName);
  } catch (err) {
    // Replication failed — wipe the partial rows we wrote for the new store
    // so the user is left cleanly on the old store. The previous store's
    // data was never touched, so it remains fully usable.
    log.warn(`Replication failed for store ${storeId} — rolling back partial data`);
    await clearStoreScopedData(storeId);
    throw err;
  }

  await activateStore(input);
  onStatusChange?.('done');

  // New store is fully live. Free the old store's per-store rows. Run last
  // so a failure here cannot corrupt the now-active store.
  await cleanupPreviousStore(input.previousStoreGuuid, storeGuuid);
}

async function activateStore(input: SelectStoreInput): Promise<void> {
  const { storeId, storeGuuid, dispatch } = input;
  await storesRepository.touchAccessed(storeId);
  await setActiveStoreByGuuid(dispatch, storeGuuid);
}

async function cleanupPreviousStore(
  previousStoreGuuid: string | null,
  newStoreGuuid: string,
): Promise<void> {
  if (!previousStoreGuuid || previousStoreGuuid === newStoreGuuid) return;

  const previous = await storesRepository.findByGuuid(previousStoreGuuid);
  if (!previous) {
    log.warn(`Previous store ${previousStoreGuuid} not in local DB — nothing to clean`);
    return;
  }

  try {
    await clearStoreScopedData(previous.id);
  } catch (err) {
    // Non-fatal: the new store is already active and usable. Stale rows
    // from the old store will be overwritten on its next replication.
    log.error(`Failed to clean previous store ${previous.id}:`, err);
  }
}
