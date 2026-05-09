/**
 * Store Replicator — first-time full replication of a store's reference data.
 *
 * What it does:
 *   1. Marks the local `stores` row as `in_progress`.
 *   2. Drives the existing pull engine (runPullOnly) until all sync tables
 *      have caught up to the server's current state.
 *   3. On success: marks `complete`, writes sync metadata, populates cache.
 *   4. On failure: marks `failed` with the error message and rethrows.
 *
 * What it does NOT do (deliberately, until backend support exists):
 *   - Timestamp-based pagination (the backend uses cursor-based pagination).
 *   - Roles/permissions snapshot (`GET /stores/:id/config` is not implemented).
 *   - Atomic table-rename commit (overkill for the current 3 reference tables;
 *     each table's own batch upsert is already a transaction).
 *
 * Scope:
 *   This is the "first sync after login / after store-create / after switch"
 *   helper. Ongoing delta sync continues to flow through sync-engine.ts.
 */

import { runPullOnly } from './sync-engine';
import { storesRepository } from '../database/repositories/stores.repository';
import { storeCacheRepository } from '../database/repositories/store-cache.repository';
import { syncMetadataRepository } from '../database/repositories/sync-metadata.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('StoreReplicator');

export interface ReplicateOptions {
  /** Aborts the replication if it runs longer than this. Default 5 minutes. */
  timeoutMs?: number;
  /** Estimated payload size for the cache row. Optional. */
  estimatedSize?: number;
}

export class StoreReplicationInProgressError extends Error {
  constructor(storeId: number) {
    super(`Store ${storeId} is already replicating`);
    this.name = 'StoreReplicationInProgressError';
  }
}

export class StoreReplicationTimeoutError extends Error {
  constructor(storeId: number, timeoutMs: number) {
    super(`Store ${storeId} replication timed out after ${timeoutMs}ms`);
    this.name = 'StoreReplicationTimeoutError';
  }
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const inFlight = new Map<number, Promise<void>>();

export const storeReplicator = {
  /**
   * Replicate a store. Idempotent per (storeId): callers racing on the same
   * store will await the same promise instead of starting parallel syncs.
   */
  replicateStore(
    storeId: number,
    storeGuuid: string,
    storeName: string,
    options: ReplicateOptions = {},
  ): Promise<void> {
    const existing = inFlight.get(storeId);
    if (existing) return existing;

    const promise = run(storeId, storeGuuid, storeName, options).finally(() => {
      inFlight.delete(storeId);
    });
    inFlight.set(storeId, promise);
    return promise;
  },

  isReplicating(storeId: number): boolean {
    return inFlight.has(storeId);
  },

  isAnyReplicating(): boolean {
    return inFlight.size > 0;
  },
};

async function run(
  storeId: number,
  storeGuuid: string,
  storeName: string,
  options: ReplicateOptions,
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Ensure the parent stores row exists before any FK-dependent write.
  // The user may be replicating a freshly-created store that login bootstrap
  // never saw, or one that the user just switched to from the picker.
  await ensureStoreRow(storeId, storeGuuid, storeName);

  await storesRepository.updateStatus(storeId, 'in_progress');
  log.info(`Replicating store ${storeId} (${storeName})`);

  try {
    await withTimeout(runPullOnly(storeGuuid), timeoutMs, storeId);

    await storesRepository.markComplete(storeId);
    await syncMetadataRepository.upsert(storeId, {
      lastSyncTimestamp: Date.now(),
    });
    await storeCacheRepository.save({
      storeId,
      storeGuuid,
      storeName,
      estimatedSize: options.estimatedSize,
    });

    log.info(`Replication complete for store ${storeId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await storesRepository.updateStatus(storeId, 'failed', message);
    log.error(`Replication failed for store ${storeId}:`, err);
    throw err;
  }
}

async function ensureStoreRow(
  storeId: number,
  storeGuuid: string,
  storeName: string,
): Promise<void> {
  const existing = await storesRepository.findById(storeId);
  if (existing) return;

  const now = Date.now();
  await storesRepository.upsertMany([{
    id:        storeId,
    guuid:     storeGuuid,
    name:      storeName,
    address:   null,
    phone:     null,
    createdAt: now,
    updatedAt: now,
  }]);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, storeId: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new StoreReplicationTimeoutError(storeId, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
