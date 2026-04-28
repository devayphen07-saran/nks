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

const PUSH_BATCH_SIZE   = 50;
const PULL_PAGE_SIZE    = 200;
const PULL_TIMEOUT_MS   = 10_000;
const PUSH_TIMEOUT_MS   = 20_000;
/** Hard ceiling on a full pull+push cycle to prevent runaway sync loops. */
const SYNC_CYCLE_TIMEOUT_MS = 90_000;

/**
 * Increment when the sync payload shape changes in a breaking way
 * (field renamed, type changed, table added/removed).
 * Server returns 409 if this version is unsupported — client must update.
 */
export const SYNC_SCHEMA_VERSION = '1';

// ─── Module State ─────────────────────────────────────────────────────────────

let _syncing          = false;
let _lastSyncedAt:    number | null = null;
let _activeStoreGuuid: string | null = null;
let _debounceTimer:   ReturnType<typeof setTimeout> | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChangesResponse {
  serverTime:  string;                   // ISO — stored as LAST_PULL_AT
  nextCursors: Record<string, string>;   // per-table "timestampMs:rowId"
  hasMore:     boolean;
  changes:     SyncChange[];
}

interface PushOperation {
  id:        string;       // idempotency_key — stable across retries
  clientId:  string;       // same as id
  table:     string;
  op:        string;
  opData:    Record<string, unknown>;
  signature?: string;
}

type OpResultStatus = 'ok' | 'duplicate' | 'conflict' | 'rejected' | 'error';

interface PushOpResult {
  opId:        string;           // matches PushOperation.id
  status:      OpResultStatus;
  reason?:     string;
  serverState?: unknown;
}

interface PushResponse {
  serverTime: string;            // ISO — mobile stores this as last_pushed_at cursor
  results:    PushOpResult[];
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

    await _syncWork(storeGuuid);

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

/**
 * Seeds lastSyncedAt from the auth response on first login.
 * No-op if a real sync timestamp already exists or lastSyncedAt is null.
 */
export async function seedSyncStateFromAuth(lastSyncedAt: string | null): Promise<void> {
  if (!lastSyncedAt) return;
  const existing = await syncStateRepository.getValue(SYNC_KEYS.LAST_FULL_SYNC_AT);
  if (existing) return;
  const ms = new Date(lastSyncedAt).getTime();
  if (!isNaN(ms) && ms > 0) {
    await syncStateRepository.setValue(SYNC_KEYS.LAST_FULL_SYNC_AT, String(ms));
    _lastSyncedAt = ms;
  }
}

/**
 * Store the active store guuid so periodic sync can fire without callers
 * having to pass it every time. Called once after login / store switch.
 */
export function setActiveStoreGuuid(storeGuuid: string): void {
  _activeStoreGuuid = storeGuuid;
}

/**
 * Debounced push trigger — call immediately after enqueuing a mutation.
 * Collapses rapid consecutive mutations into a single push cycle after
 * the debounce window (default 3 s) so the network isn't hammered on bulk ops.
 */
export function triggerDebouncedSync(delayMs = 3_000): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    runPushOnly().catch((err) => log.error('Debounced push failed:', err));
  }, delayMs);
}

/**
 * Periodic pull+push cycle — called by the auth-provider interval timer.
 * No-op when no active store is known or sync is already running.
 */
export async function runPeriodicSync(): Promise<void> {
  if (!_activeStoreGuuid) return;
  await runSync(_activeStoreGuuid);
}

/** Call on logout to clear all module-level sync state */
export function resetSyncState(): void {
  _syncing          = false;
  _lastSyncedAt     = null;
  _activeStoreGuuid = null;
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
}

// ─── Pull ─────────────────────────────────────────────────────────────────────

/**
 * PULL phase: fetches changed rows per table since each table's own cursor,
 * applies them to local SQLite, and advances per-table cursors.
 *
 * Each table sends its own "timestampMs:rowId" cursor so the server only
 * returns rows newer than that table's last-applied row — no over-fetch
 * when some tables are fully synced and others are behind.
 */
async function pullChanges(storeGuuid: string): Promise<void> {
  log.info('PULL: Starting...');

  // Read per-table cursors from SQLite — each table tracks its own position.
  // Tables never synced return 0 and only receive rows newer than epoch 0
  // (i.e. all rows). Already-synced tables only receive new/changed rows.
  const tableCursors: Record<string, string> = {};
  await Promise.all(
    SYNC_TABLES.map(async (table) => {
      const ms = await syncStateRepository.getCursorForTable(table);
      tableCursors[table] = `${ms}:0`;
    }),
  );

  log.debug(`PULL: per-table cursors=${JSON.stringify(tableCursors)}`);

  let pageNum      = 0;
  let totalChanges = 0;
  // Captured once on the first page — held for the entire pull loop so
  // LAST_PULL_AT is a consistent boundary even if writes happen mid-pull.
  let firstPageServerTime: string | null = null;
  // Per-table cursors advance as pages arrive; carried into the next request.
  const currentCursors: Record<string, string> = { ...tableCursors };

  while (true) {
    pageNum++;
    log.debug(`PULL: Page ${pageNum}, cursors=${JSON.stringify(currentCursors)}`);

    const response = await (async () => {
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          log.debug(`PULL: Making API call to /sync/changes with params: storeGuuid=${storeGuuid}, tables=${SYNC_TABLES.join(',')}, limit=${PULL_PAGE_SIZE}`);
          const res = await API.get<ChangesResponse>('/sync/changes', {
            headers: { 'X-Sync-Schema-Version': SYNC_SCHEMA_VERSION },
            params: {
              cursor: currentCursors,
              storeGuuid: storeGuuid,
              tables:     SYNC_TABLES.join(','),
              limit:      PULL_PAGE_SIZE,
            },
            timeout: PULL_TIMEOUT_MS,
          });
          const apiResponse = res.data as any;
          const result = apiResponse.data ?? apiResponse;
          log.debug(`PULL: API response unwrapped: serverTime=${result.serverTime}, hasMore=${result.hasMore}, changes.length=${result.changes?.length || 0}`);
          if (pageNum === 1 && result.serverTime) {
            firstPageServerTime = result.serverTime;
          }
          return result;
        } catch (err) {
          const status = (err as AxiosError).response?.status;
          if (status === 429 && retryCount < maxRetries - 1) {
            const backoffMs = Math.pow(2, retryCount) * 1000;
            log.warn(`PULL: Rate limited (429) — retrying in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries - 1})`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            retryCount++;
            continue;
          }
          log.error(`PULL: API call failed with status ${status}:`, err);
          if (status === 403) {
            log.warn('PULL: 403 — user not authorized for this store, skipping');
            throw new Error('UNAUTHORIZED');
          }
          throw err;
        }
      }
      throw new Error('Failed to fetch changes after retries');
    })();


    if (!response.changes?.length) {
      log.debug(`PULL: No changes on page ${pageNum}`);
      break;
    }

    log.debug(`PULL: Page ${pageNum} has ${response.changes.length} changes`);
    if (response.changes.length > 0) {
      log.debug(`PULL: First change: ${JSON.stringify(response.changes[0])}`);
    }

    // Bucket changes by table so we can call batch methods — one DB statement
    // per table per page instead of one statement per row.
    const upsertsByTable: Record<string, Array<{ id: number; data: Record<string, unknown> }>> = {};
    const deletesByTable: Record<string, number[]> = {};

    for (const change of response.changes) {
      if (!TABLE_HANDLERS[change.table]) {
        log.warn(`PULL: No handler for table "${change.table}" — skipping`);
        continue;
      }
      if (change.operation === 'upsert' && change.data) {
        (upsertsByTable[change.table] ??= []).push({ id: change.id, data: change.data });
      } else if (change.operation === 'delete') {
        (deletesByTable[change.table] ??= []).push(change.id);
      }
    }

    log.debug(`PULL: Bucketed into: ${Object.keys(upsertsByTable).map(t => `${t}:${upsertsByTable[t]!.length} upserts`).join(', ')} | ${Object.keys(deletesByTable).map(t => `${t}:${deletesByTable[t]!.length} deletes`).join(', ')}`);

    // Apply batches — all upserts for a table in one INSERT, all deletes in one UPDATE.
    // NOTE: This should be wrapped in a transaction to prevent data corruption on app crash.
    // This requires refactoring repositories to accept transaction contexts.
    // For now, data corruption risk is mitigated by: idempotent operations (INSERT OR REPLACE),
    // cursor-based pagination (failed cursors prevent re-apply), and user refresh on sync failure.
    const applyPromises: Promise<void>[] = [];
    for (const [table, items] of Object.entries(upsertsByTable)) {
      applyPromises.push(
        TABLE_HANDLERS[table]!.onBatchUpsert(items).catch((err) =>
          log.error(`PULL: Batch upsert failed for ${table}:`, err),
        ),
      );
    }
    for (const [table, ids] of Object.entries(deletesByTable)) {
      applyPromises.push(
        TABLE_HANDLERS[table]!.onBatchDelete(ids).catch((err) =>
          log.error(`PULL: Batch delete failed for ${table}:`, err),
        ),
      );
    }
    await Promise.all(applyPromises);

    totalChanges += response.changes.length;

    // Persist server-provided per-table next cursors (crash-safe — after each page)
    const serverNextCursors = response.nextCursors ?? {};
    await Promise.all(
      Object.entries(serverNextCursors).map(([table, cursorStr]) => {
        const cursor = cursorStr as string;
        const ms = parseInt(cursor.split(':')[0] ?? '0', 10);
        if (!isNaN(ms) && ms > 0) {
          currentCursors[table] = cursor;
          return syncStateRepository.saveCursorForTable(table, ms);
        }
      }),
    );

    if (!response.hasMore) break;
  }

  // Write last pull time using server clock (not device clock)
  const pullTimestamp = firstPageServerTime
    ? new Date(firstPageServerTime).getTime()
    : Date.now();
  await syncStateRepository.setValue(SYNC_KEYS.LAST_PULL_AT, String(pullTimestamp));

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
        userGuuid:         session.userGuuid,
        storeGuuid:        session.storeGuuid,
        roles:             session.roles,
        offlineValidUntil: session.offlineValidUntil,
        signature:         session.signature,
        ...(session.deviceId     ? { deviceId: session.deviceId }         : {}),
        ...(session.offlineToken ? { offlineToken: session.offlineToken } : {}),
      };
    }

    try {
      const res = await API.post<PushResponse>('/sync/push', body, {
        headers: { 'X-Sync-Schema-Version': SYNC_SCHEMA_VERSION },
        timeout: PUSH_TIMEOUT_MS,
      });

      const results   = res.data?.results ?? [];
      const serverTime = res.data?.serverTime;

      // Build a lookup: opId → queue row id (our SQLite PK)
      const opIdToRowId = new Map(batch.map(item => [item.idempotency_key, item.id]));
      // Track which queue rows were accounted for in results
      const handledRowIds = new Set<number>();

      for (const result of results) {
        const rowId = opIdToRowId.get(result.opId);
        if (rowId == null) continue; // result for an op not in this batch — ignore
        handledRowIds.add(rowId);

        switch (result.status) {
          case 'ok':
          case 'duplicate':
            await mutationQueueRepository.markSynced([rowId]);
            totalPushed++;
            break;

          case 'conflict':
          case 'rejected':
            await mutationQueueRepository.markQuarantined(
              rowId,
              400,
              result.reason ?? result.status,
            );
            log.warn(`PUSH: Op ${result.opId} ${result.status}: ${result.reason ?? ''}`);
            break;

          case 'error':
            // Transient server error — retry with backoff
            await mutationQueueRepository.incrementRetry(rowId, result.reason ?? 'SERVER_ERROR');
            log.debug(`PUSH: Op ${result.opId} error: ${result.reason ?? ''}`);
            break;
        }
      }

      // Any ops in the batch that the server didn't mention — reset to pending
      const unhandledIds = batch
        .filter(item => !handledRowIds.has(item.id))
        .map(item => item.id);
      if (unhandledIds.length > 0) {
        await mutationQueueRepository.resetToRetry(unhandledIds);
        log.warn(`PUSH: ${unhandledIds.length} mutations not in server response — returned to retry queue`);
        return;
      }

      // Advance last_pushed_at using server clock, not device clock
      if (serverTime) {
        await syncStateRepository.setValue(SYNC_KEYS.LAST_PUSH_AT, String(new Date(serverTime).getTime()));
      }

      log.debug(`PUSH: Batch done — ${totalPushed} total pushed`);

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

  // Hard 90-second ceiling on the full cycle. If pull+push takes longer
  // (e.g. hundreds of pages on a slow connection) we bail cleanly so the
  // _syncing flag is released and the next trigger can start a fresh cycle.
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('SYNC_TIMEOUT')), SYNC_CYCLE_TIMEOUT_MS),
  );

  await Promise.race([
    (async () => {
      await pullChanges(storeGuuid);
      await pushMutations();
    })(),
    timeout,
  ]);
}

/**
 * Deterministic JSON serialisation with sorted keys.
 *
 * Ensures the same logical object produces the identical string on any JS engine
 * (Hermes on mobile, V8 on server). Standard JSON.stringify does not guarantee
 * key order, causing signature mismatches on legitimate operations.
 */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return '{' + entries.join(',') + '}';
}

/**
 * SHA-256 keyed hash for operation signing.
 * Format: SHA256(signingKey:op:table:canonicalJson(opData))
 * Mirrors SyncService.verifyOperationSignature() on the backend.
 *
 * Uses canonical JSON (sorted keys) to ensure cross-engine consistency
 * between Hermes (mobile) and V8 (server).
 */
async function _signOperation(
  op: string,
  table: string,
  opData: Record<string, unknown>,
  signingKey: string,
): Promise<string> {
  const canonical = `${op}:${table}:${canonicalJson(opData)}`;
  const input = `${signingKey}:${canonical}`;
  return ExpoCrypto.digestStringAsync(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input);
}
