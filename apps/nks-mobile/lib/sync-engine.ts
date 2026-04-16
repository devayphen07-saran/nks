/**
 * Sync Engine — Offline-first pull + push sync orchestration.
 *
 * Lightweight HTTP-based offline sync:
 *   - PULL: GET /sync/changes paginated, apply to local SQLite
 *   - PUSH: POST /sync/push batched mutations, delete on success
 *
 * Usage:
 *   import { runSync } from '@/lib/sync-engine';
 *
 *   // Start sync (blocks until complete or timeout)
 *   await runSync(storeGuuid);
 *
 *   // Check sync state
 *   if (isSyncing()) { console.log('Still syncing...'); }
 *   const ts = getLastSyncedAt();
 */

import { API } from '@nks/api-manager';
import type { AxiosError } from 'axios';
import type { SQLiteBindValue } from 'expo-sqlite';
import {
  getCursor,
  saveCursor,
  getMutationQueueBatch,
  deleteMutationsById,
  incrementMutationRetry,
  initializeDatabase,
  getDatabase,
} from './local-db';
import { offlineSession } from './offline-session';
import { createLogger } from './logger';
import * as ExpoCrypto from 'expo-crypto';

const log = createLogger('SyncEngine');

/**
 * Coerce an unknown value from a server JSON payload to a type
 * that expo-sqlite can bind as a query parameter.
 * Objects, arrays, and undefined all become null.
 */
function toBindValue(v: unknown): SQLiteBindValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  return null;
}

// Sync state tracking
let _syncing = false;
let _lastSyncedAt: number | null = null;

const PUSH_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const SYNC_TIMEOUT_MS = 25_000; // 5s margin before backend's 30s REQUEST_TIMEOUT_MS

/**
 * Response type from GET /sync/changes
 */
interface ChangesResponse {
  nextCursor: number;
  hasMore: boolean;
  changes: Array<{
    table: string;
    id: number;
    operation: 'upsert' | 'delete';
    data: Record<string, unknown> | null;
  }>;
}

/**
 * Request type for POST /sync/push
 */
interface PushOperation {
  id: string;
  clientId: string;
  table: string;
  op: string;
  opData: Record<string, unknown>;
  signature?: string;
}

/**
 * Compute a keyed SHA-256 hash over the canonical operation fields.
 * Mirrors the server-side verification in SyncService.verifyOperationSignature().
 *
 * Format: SHA256(signingKey + ":" + op + ":" + table + ":" + JSON.stringify(opData))
 */
async function signOperation(
  op: string,
  table: string,
  opData: Record<string, unknown>,
  signingKey: string,
): Promise<string> {
  const canonical = `${op}:${table}:${JSON.stringify(opData)}`;
  const input = `${signingKey}:${canonical}`;
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input);
}

/**
 * Run the full sync cycle (pull then push).
 *
 * PULL: Fetches changes from backend since cursor, applies to local DB.
 * PUSH: Sends pending mutations from queue, deletes on success.
 *
 * Handles pagination, retries, and timeout. Throws on unrecoverable errors.
 *
 * @param storeGuuid Store identifier (UUID string)
 * @throws On network errors or sync timeout (not on invalid/unauthorized storeGuuid — returns gracefully)
 */
export async function runSync(storeGuuid: string): Promise<void> {
  if (_syncing) {
    log.debug('Sync already in progress — skipping');
    return;
  }

  _syncing = true;

  try {
    const startTime = Date.now();

    const syncWork = async () => {
      // Ensure database is initialized
      await initializeDatabase();

      log.info(`Sync starting for store: ${storeGuuid}`);

      // Step 1: PULL all changes since cursor
      await pullChanges(storeGuuid);

      // Step 2: PUSH pending mutations
      await pushMutations();

      _lastSyncedAt = Date.now();
      log.info(`Sync complete in ${Date.now() - startTime}ms`);
    };

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT_MS),
    );

    await Promise.race([syncWork(), timeoutPromise]);
  } catch (err) {
    log.error('Sync failed:', err);
    throw err;
  } finally {
    _syncing = false;
  }
}

/**
 * Check if sync is currently running.
 */
export function isSyncing(): boolean {
  return _syncing;
}

/**
 * Get the timestamp of the last successful sync (milliseconds since epoch).
 * Returns null if no sync has completed yet.
 */
export function getLastSyncedAt(): number | null {
  return _lastSyncedAt;
}

/**
 * Resets module-level sync state. Call on logout to prevent
 * stale flags from leaking across user sessions.
 */
export function resetSyncState(): void {
  _syncing = false;
  _lastSyncedAt = null;
}

/**
 * PULL changes from backend since cursor, applying to local DB.
 * Paginates through all pages until hasMore=false.
 */
async function pullChanges(storeGuuid: string): Promise<void> {
  log.info('PULL: Starting change sync...');

  const db = getDatabase();
  let cursor = await getCursor();
  let pageNum = 0;
  let totalChanges = 0;

  while (true) {
    pageNum++;
    log.debug(`PULL: Fetching page ${pageNum}, cursor=${cursor}`);

    let response: ChangesResponse;
    try {
      const res = await API.get<ChangesResponse>('/sync/changes', {
        params: {
          cursor,
          storeId: storeGuuid,
          tables: 'routes',
        },
        timeout: 10_000,
      });

      response = res.data;
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 403) {
        log.warn('PULL: User not in store — skipping sync');
        return;
      }
      throw err;
    }

    if (!response.changes || response.changes.length === 0) {
      log.info(`PULL: No changes in page ${pageNum}`);
      break;
    }

    // Apply changes to local DB
    let applied = 0;

    for (const change of response.changes) {
      if (change.table === 'routes') {
        if (change.operation === 'upsert' && change.data) {
          // INSERT OR REPLACE
          const data = change.data as Record<string, unknown>;
          await db.runAsync(
            `
            INSERT OR REPLACE INTO routes
            (id, guuid, parent_route_fk, route_name, route_path, full_path,
             description, icon_name, route_type, route_scope, is_public,
             is_active, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              change.id,
              toBindValue(data.guuid),
              toBindValue(data.parentRouteFk),
              toBindValue(data.routeName),
              toBindValue(data.routePath),
              toBindValue(data.fullPath),
              toBindValue(data.description),
              toBindValue(data.iconName),
              toBindValue(data.routeType),
              toBindValue(data.routeScope),
              data.isPublic ? 1 : 0,
              data.isActive ? 1 : 0,
              toBindValue(data.createdAt),
              toBindValue(data.updatedAt),
              null, // deletedAt = null for upsert
            ],
          );
        } else if (change.operation === 'delete') {
          // DELETE
          await db.runAsync('DELETE FROM routes WHERE id = ?', [change.id]);
        }
        applied++;
      }
    }

    totalChanges += applied;
    log.debug(`PULL: Applied ${applied} changes in page ${pageNum}`);

    // Save cursor and check for more
    await saveCursor(response.nextCursor);
    cursor = response.nextCursor;

    if (!response.hasMore) {
      break;
    }
  }

  log.info(`PULL: Synced ${totalChanges} total changes`);
}

/**
 * PUSH pending mutations from queue to backend.
 * Deletes from queue on success, increments retries on failure.
 * Stops on first failure (does not skip ahead).
 */
async function pushMutations(): Promise<void> {
  log.info('PUSH: Starting mutation push...');

  // Load once per push cycle — avoids repeated SecureStore reads per batch
  const session = await offlineSession.load();

  while (true) {
    const batch = await getMutationQueueBatch(PUSH_BATCH_SIZE);

    if (batch.length === 0) {
      log.info('PUSH: Queue empty');
      return;
    }

    log.debug(`PUSH: Sending batch of ${batch.length} mutations`);

    // Convert queue format to sync.push format, signing each operation
    // if we have a session signature available.
    const operations: PushOperation[] = await Promise.all(
      batch.map(async (item) => {
        const op: PushOperation = {
          id: String(item.id),
          clientId: `${item.id}-${Date.now()}`,
          table: item.entity,
          op: item.operation,
          opData: item.payload,
        };
        if (session?.signature) {
          op.signature = await signOperation(
            item.operation,
            item.entity,
            item.payload,
            session.signature,
          );
        }
        return op;
      }),
    );

    // Include offline session context so the server can re-validate the HMAC
    // signature and detect any on-device tampering of userId/storeId/roles.
    const body: Record<string, unknown> = { operations };
    if (session?.signature) {
      body.offlineSession = {
        userId: session.userId,
        storeId: session.storeId,
        roles: session.roles,
        offlineValidUntil: session.offlineValidUntil,
        signature: session.signature,
        ...(session.deviceId ? { deviceId: session.deviceId } : {}),
        // Include the RS256 offline JWT so the server can verify its signature
        // and cross-validate claims against the HMAC payload (write-guard).
        ...(session.offlineToken ? { offlineToken: session.offlineToken } : {}),
      };
    }

    try {
      const res = await API.post<{ processed: number }>(
        '/sync/push',
        body,
        { timeout: 20_000 },
      );

      const processed = res.data?.processed ?? 0;

      if (processed > 0) {
        const idsToDelete = batch.slice(0, processed).map((item) => item.id);
        await deleteMutationsById(idsToDelete);
        log.debug(`PUSH: Deleted ${idsToDelete.length} mutations from queue`);
      }

      // Check if there are more batches
      if (processed < batch.length) {
        // Some failed — stop here and don't retry
        log.warn(
          `PUSH: Only ${processed}/${batch.length} processed — stopping queue`,
        );
        return;
      }

      // All succeeded — loop to next batch
    } catch (err) {
      // Increment retries on first mutation in batch
      if (batch.length > 0) {
        await incrementMutationRetry(batch[0].id);

        if (batch[0].retries + 1 >= MAX_RETRIES) {
          log.warn(
            `PUSH: Max retries reached for mutation ${batch[0].id} — skipping`,
          );
          // Delete this mutation and continue with next
          await deleteMutationsById([batch[0].id]);
        }
      }

      log.warn(`PUSH: Batch failed, retrying later:`, err);
      return; // Stop queue on any error
    }
  }
}
