/**
 * Local stores-table bootstrap.
 *
 * Two entry points:
 *   - initializeStoresAfterLogin(): runs once after login. Fetches the user's
 *     stores, mirrors them locally, and kicks off replication for the default
 *     store. Network failure is raised; the caller in persistLogin already
 *     wraps this in a non-critical .catch().
 *   - refreshLocalStores(): re-fetches the list, useful right after store
 *     creation when we need a freshly-created store's numeric id locally.
 */

import { API } from '@nks/api-manager';
import type {
  AuthResponse,
  GetMyStoresResponse,
  StoreSummary,
} from '@nks/api-manager';
import { storesRepository } from '../database/repositories/stores.repository';
import { storeReplicator } from '../sync/store-replicator';
import { createLogger } from '../utils/logger';

const log = createLogger('InitializeStores');

const STORES_ME_PATH = '/stores/me';
const STORES_ME_TIMEOUT_MS = 10_000;

export async function initializeStoresAfterLogin(
  authResponse: AuthResponse,
): Promise<void> {
  const stores = await refreshLocalStores();
  if (stores.length === 0) {
    log.info('User has no stores yet');
    return;
  }
  await replicateDefaultStore(authResponse, stores);
}

/**
 * Fetches /stores/me and upserts every row into local SQLite.
 * Returns the fetched list. Throws on network/backend failure — callers
 * decide how to react.
 */
export async function refreshLocalStores(): Promise<StoreSummary[]> {
  const res = await API.get<GetMyStoresResponse>(STORES_ME_PATH, {
    timeout: STORES_ME_TIMEOUT_MS,
  });
  const body = res.data;
  const stores = [...body.data.myStores, ...body.data.invitedStores];

  if (stores.length > 0) {
    await upsertStores(stores);
  }
  return stores;
}

async function upsertStores(stores: StoreSummary[]): Promise<void> {
  const now = Date.now();
  const rows = stores.map((s) => ({
    id:             s.id,
    guuid:          s.guuid,
    name:           s.storeName,
    address:        s.address,
    phone:          s.phone,
    isDefaultStore: s.isDefault ? 1 : 0,
    createdAt:      now,
    updatedAt:      now,
  }));
  await storesRepository.upsertMany(rows);
  log.info(`Upserted ${rows.length} stores`);
}

async function replicateDefaultStore(
  authResponse: AuthResponse,
  stores: StoreSummary[],
): Promise<void> {
  const defaultGuuid = authResponse.context?.defaultStoreGuuid;
  if (!defaultGuuid) return;

  const target = stores.find((s) => s.guuid === defaultGuuid);
  if (!target) {
    log.warn(`Default store ${defaultGuuid} not found in /stores/me response`);
    return;
  }

  // Fire-and-forget. Login completes immediately; the stores row's
  // replicationStatus reflects progress for any UI that wants to show it.
  storeReplicator
    .replicateStore(target.id, target.guuid, target.storeName)
    .catch((err) => {
      log.error(`Default store replication failed for ${target.guuid}:`, err);
    });
}
