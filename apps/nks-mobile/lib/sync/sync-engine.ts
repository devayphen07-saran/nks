/**
 * Sync Engine — Offline-first pull + push sync orchestration.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  PULL  →  GET /sync/changes?storeId=X&cursor[table]=Y           │
 * │           per-table cursor, all tables in one request           │
 * │           apply changes → advance per-table cursor              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  PUSH  →  POST /sync/push { operations[], offlineSession }      │
 * │           FIFO batch (50), idempotency key, HMAC signed         │
 * │           mark synced on success, backoff + quarantine on fail  │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   await runSync(storeGuuid);         // full pull + push cycle
 *   await runPullOnly(storeGuuid);     // pull without push (read-only mode)
 *   await runPushOnly();               // push without pull (flush queue)
 *   isSyncing();                       // true while sync in progress
 *   getLastSyncedAt();                 // ms epoch of last successful sync
 */

import { API } from '@nks/api-manager';
import type { AxiosError } from 'axios';
import * as ExpoCrypto from 'expo-crypto';

import { syncStateRepository } from '../database/repositories/sync-state.repository';
import { mutationQueueRepository } from '../database/repositories/mutation-queue.repository';
import { initializeDatabase } from '../database/connection';
import { SYNC_KEYS } from '../database/constants/sync-keys';
import { offlineSession } from '../auth/offline-session';
import { TABLE_HANDLERS, SYNC_TABLES, type SyncChange } from './sync-table-handlers';
import { createLogger } from '../utils/logger';

const log = createLogger('SyncEngine');

// ─── Config ───────────────────────────────────────────────────────────────────

const PUSH_BATCH_SIZE  = 50;
const PULL_PAGE_SIZE   = 200;
const SYNC_TIMEOUT_MS  = 25_000; // 5s margin before backend's 30s REQUEST_TIMEOUT_MS
const PULL_TIMEOUT_MS  = 10_000;
const PUSH_TIMEOUT_MS  = 20_000;

// ─── Module State ─────────────────────────────────────────────────────────────

let _syncing       = false;
let _lastSyncedAt: number | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangesResponse {
  nextCursor: number;      // max updated_at across all returned changes (Unix ms)
  hasMore:    boolean;
  changes:    SyncChange[];
}

interface PushOperation {
  id:        string;       // idempotency_key — stable across retries
  clientId:  string;       // same as id
  table:     string;
  op:        string;
  opData:    Record<string, unknown>;
  signature?: string;
}

interface PushResponse {
  processed:   number;     // how many operations the server successfully applied
  rejected?:   number;     // how many were rejected (invalid signature, etc.)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full sync cycle: pull all changes, then push all pending mutations.
 * Skips if already running. Times out after 25 seconds.
 */
export async function runSync(storeGuuid: string): Promise<void> {
  if (_syncing) {
    log.debug('Sync already in progress — skipping');
    return;
  }

  _syncing = true;

  try {
    const started = Date.now();

    await Promise.race([
      _syncWork(storeGuuid),
      _timeout(SYNC_TIMEOUT_MS, 'Sync timed out after 25s'),
    ]);

    _lastSyncedAt = Date.now();
    await syncStateRepository.setValue(SYNC_KEYS.LAST_FULL_SYNC_AT, String(_lastSyncedAt));
    log.info(`Sync complete in ${Date.now() - started}ms`);
  } catch (err) {
    log.error('Sync failed:', err);
    throw err;
  } finally {
    _syncing = false;
  }
}

/** Pull only — for read-only / background refresh without pushing local mutations */
export async function runPullOnly(storeGuuid: string): Promise<void> {
  if (_syncing) return;
  _syncing = true;
  try {
    await initializeDatabase();
    await pullChanges(storeGuuid);
  } finally {
    _syncing = false;
  }
}

/** Push only — for when you know there are pending mutations but don't need a full pull */
export async function runPushOnly(): Promise<void> {
  if (_syncing) return;
  _syncing = true;
  try {
    await initializeDatabase();
    await pushMutations();
  } finally {
    _syncing = false;
  }
}

export function isSyncing(): boolean {
  return _syncing;
}

export function getLastSyncedAt(): number | null {
  return _lastSyncedAt;
}

/** Call on app startup to restore persisted lastSyncedAt and reset stuck mutations */
export async function initializeSyncEngine(): Promise<void> {
  // Restore persisted last sync time
  const stored = await syncStateRepository.getValue(SYNC_KEYS.LAST_FULL_SYNC_AT);
  if (stored) _lastSyncedAt = parseInt(stored, 10);

  // Reset any mutations stuck in 'in_progress' from a previous crashed session
  const reset = await mutationQueueRepository.resetStuck();
  if (reset > 0) {
    log.warn(`Reset ${reset} stuck in_progress mutations from previous session`);
  }
}

/** Call on logout to clear all module-level sync state */
export function resetSyncState(): void {
  _syncing      = false;
  _lastSyncedAt = null;
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

/**
 * PULL phase: fetches all changed rows from the server since the last known
 * cursor per table, applies them to local SQLite, and advances cursors.
 *
 * Per-table cursors:
 *   - Each table tracks its own cursor (Unix ms timestamp of last applied change)
 *   - The server receives the MINIMUM cursor across all tables as the "since" window
 *   - Changes are applied only to matching table handlers
 *   - After applying, each table's cursor advances to the change's updatedAt
 *
 *   Example:
 *     routes cursor       = 1714000000  (fully synced 2h ago)
 *     entity_permissions  = 0           (never synced)
 *     Min cursor sent     = 0           (server returns everything since 0)
 *     After pull:
 *       routes cursor       = 1714050000  (unchanged if no new routes)
 *       entity_permissions  = 1714050000  (now has data)
 */
async function pullChanges(storeGuuid: string): Promise<void> {
  log.info('PULL: Starting...');

  // Read per-table cursors
  const tableCursors: Record<string, number> = {};
  await Promise.all(
    SYNC_TABLES.map(async (table) => {
      tableCursors[table] = await syncStateRepository.getCursorForTable(table);
    }),
  );

  // Server receives the minimum cursor — ensures we catch any table not yet synced
  const minCursor = Math.min(...Object.values(tableCursors));

  log.debug(`PULL: cursors=${JSON.stringify(tableCursors)}, sending minCursor=${minCursor}`);

  let pageNum      = 0;
  let totalChanges = 0;
  let currentCursor = minCursor;

  while (true) {
    pageNum++;
    log.debug(`PULL: Page ${pageNum}, cursor=${currentCursor}`);

    let response: ChangesResponse;
    try {
      const res = await API.get<ChangesResponse>('/sync/changes', {
        params: {
          cursor:  currentCursor,
          storeId: storeGuuid,
          tables:  SYNC_TABLES.join(','),
          limit:   PULL_PAGE_SIZE,
        },
        timeout: PULL_TIMEOUT_MS,
      });
      response = res.data;
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 403) {
        log.warn('PULL: 403 — user not authorized for this store, skipping');
        return;
      }
      throw err; // network errors bubble up to runSync()
    }

    if (!response.changes?.length) {
      log.debug(`PULL: No changes on page ${pageNum}`);
      break;
    }

    // Apply each change to the correct repository, track per-table cursor
    const newTableCursors: Record<string, number> = { ...tableCursors };

    for (const change of response.changes) {
      const handler = TABLE_HANDLERS[change.table];
      if (!handler) {
        log.warn(`PULL: No handler for table "${change.table}" — skipping`);
        continue;
      }

      try {
        if (change.operation === 'upsert' && change.data) {
          await handler.onUpsert(change.id, change.data);
        } else if (change.operation === 'delete') {
          await handler.onDelete(change.id);
        }

        // Advance this table's cursor to the change's timestamp
        if (change.updatedAt > (newTableCursors[change.table] ?? 0)) {
          newTableCursors[change.table] = change.updatedAt;
        }

        totalChanges++;
      } catch (err) {
        // Log but don't abort — a bad row shouldn't block the rest
        log.error(`PULL: Failed to apply ${change.operation} on ${change.table}[${change.id}]:`, err);
      }
    }

    // Persist updated per-table cursors after each page (crash-safe)
    await Promise.all(
      Object.entries(newTableCursors).map(([table, cursor]) => {
        if (cursor !== tableCursors[table]) {
          return syncStateRepository.saveCursorForTable(table, cursor);
        }
      }),
    );

    // Update local tracking for next loop
    Object.assign(tableCursors, newTableCursors);
    currentCursor = response.nextCursor;

    if (!response.hasMore) break;
  }

  // Write the overall last sync time
  await syncStateRepository.setValue(SYNC_KEYS.LAST_SYNC_AT, String(Date.now()));

  log.info(`PULL: Applied ${totalChanges} changes across ${pageNum} page(s)`);
}

// ─── Push ─────────────────────────────────────────────────────────────────────

/**
 * PUSH phase: sends pending mutations from the queue to the server.
 *
 * Queue states:
 *   pending      → ready to send (or retry after backoff elapsed)
 *   in_progress  → currently being sent (set before HTTP call, cleared after)
 *   synced       → server confirmed — row is deleted after acknowledgement
 *   failed       → server returned error — will retry with backoff
 *   quarantined  → max retries exceeded — needs manual attention
 *
 * Idempotency:
 *   Each mutation has a stable `idempotency_key` (uuidv7) set at enqueue time.
 *   This key is sent as both `id` and `clientId` in the PushOperation.
 *   The server deduplicates by `id` — safe to retry even if response was lost.
 *
 * Failure handling:
 *   - Network error: increment retry, set exponential backoff, stop current cycle
 *   - Server 4xx on specific operation: mark that op as failed, continue with rest
 *   - Max retries reached: quarantine (never delete — audit trail preserved)
 */
async function pushMutations(): Promise<void> {
  log.info('PUSH: Starting...');

  // Load offline session once — avoids N SecureStore reads per batch
  const session = await offlineSession.load();

  let totalPushed = 0;

  while (true) {
    // Fetch next batch of pending mutations (respects next_retry_at backoff)
    const batch = await mutationQueueRepository.findBatch(PUSH_BATCH_SIZE);

    if (batch.length === 0) {
      log.info(`PUSH: Queue empty. Pushed ${totalPushed} total.`);
      return;
    }

    log.debug(`PUSH: Sending batch of ${batch.length}`);

    // Mark batch as in_progress before sending (crash recovery)
    const batchIds = batch.map(item => item.id);
    await mutationQueueRepository.markInProgress(batchIds);

    // Build signed operations
    const operations: PushOperation[] = await Promise.all(
      batch.map(async (item) => {
        const op: PushOperation = {
          id:       item.idempotency_key,   // ← stable key, used for server dedup
          clientId: item.idempotency_key,   // ← same — never changes across retries
          table:    item.entity,
          op:       item.operation,
          opData:   item.payload,
        };
        if (session?.signature) {
          op.signature = await _signOperation(
            item.operation,
            item.entity,
            item.payload,
            session.signature,
          );
        }
        return op;
      }),
    );

    // Build request body — include offline session context for server-side re-validation
    const body: Record<string, unknown> = { operations };
    if (session) {
      body.offlineSession = {
        userId:            session.userId,
        storeId:           session.storeId,
        roles:             session.roles,
        offlineValidUntil: session.offlineValidUntil,
        signature:         session.signature,
        ...(session.deviceId     ? { deviceId: session.deviceId }         : {}),
        ...(session.offlineToken ? { offlineToken: session.offlineToken } : {}),
      };
    }

    try {
      const res = await API.post<PushResponse>('/sync/push', body, {
        timeout: PUSH_TIMEOUT_MS,
      });

      const processed = res.data?.processed ?? 0;
      const rejected  = res.data?.rejected  ?? 0;

      log.debug(`PUSH: Server processed=${processed}, rejected=${rejected}`);

      if (processed > 0) {
        // Mark the first `processed` items as synced, then delete them
        const syncedIds = batch.slice(0, processed).map(item => item.id);
        await mutationQueueRepository.markSynced(syncedIds);
        totalPushed += processed;
      }

      if (rejected > 0) {
        // Server explicitly rejected some operations (permission denied, validation failed)
        // These start after `processed`
        const rejectedStart = processed;
        for (let i = rejectedStart; i < rejectedStart + rejected && i < batch.length; i++) {
          await mutationQueueRepository.markQuarantined(
            batch[i].id,
            400,
            'Server rejected operation',
          );
        }
      }

      // If some were neither processed nor rejected, reset them to pending for retry
      const unhandledIds = batch
        .slice(processed + rejected)
        .map(item => item.id);
      if (unhandledIds.length > 0) {
        await mutationQueueRepository.resetToRetry(unhandledIds);
        log.warn(`PUSH: ${unhandledIds.length} mutations returned to retry queue`);
        return; // stop — don't skip ahead
      }

    } catch (err) {
      const status = (err as AxiosError).response?.status;

      if (status === 401 || status === 403) {
        // Auth error — reset all in_progress to pending, stop
        await mutationQueueRepository.resetToRetry(batchIds);
        log.warn('PUSH: Auth error — mutations reset for retry after re-auth');
        return;
      }

      // Network / server error — increment retry on all items in batch
      for (const item of batch) {
        const newRetries = item.retries + 1;

        if (newRetries >= item.max_retries) {
          await mutationQueueRepository.markQuarantined(
            item.id,
            status ?? 0,
            `Max retries (${item.max_retries}) reached: ${String(err)}`,
          );
          log.warn(`PUSH: Quarantined mutation ${item.id} after ${newRetries} retries`);
        } else {
          await mutationQueueRepository.incrementRetry(item.id, String(err));
          log.debug(`PUSH: Retry ${newRetries}/${item.max_retries} for mutation ${item.id}`);
        }
      }

      log.warn('PUSH: Batch failed — stopping queue for this cycle');
      return; // stop — will retry on next sync cycle
    }
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

async function _syncWork(storeGuuid: string): Promise<void> {
  await initializeDatabase();
  await pullChanges(storeGuuid);
  await pushMutations();
}

function _timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );
}

/**
 * SHA-256 keyed hash for operation signing.
 * Format: SHA256(signingKey:op:table:JSON(opData))
 * Mirrors SyncService.verifyOperationSignature() on the backend.
 */
async function _signOperation(
  op: string,
  table: string,
  opData: Record<string, unknown>,
  signingKey: string,
): Promise<string> {
  const canonical = `${op}:${table}:${JSON.stringify(opData)}`;
  const input = `${signingKey}:${canonical}`;
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input);
}
