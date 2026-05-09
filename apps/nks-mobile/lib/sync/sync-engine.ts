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

import { syncStateRepository } from '../database/repositories/sync-state.repository';
import { mutationQueueRepository } from '../database/repositories/mutation-queue.repository';
import { initializeDatabase } from '../database/connection';
import { SYNC_KEYS } from '../database/constants/sync-keys';
import { offlineSession } from '../auth/offline-session';
import { getDeviceIdentity } from '../device/device-binding';
import { tokenManager } from '@nks/mobile-utils';
import { TABLE_HANDLERS, SYNC_TABLES, type SyncChange } from './sync-table-handlers';
import { resolveConflict } from './conflict-resolver';
import { scanCascadingFailures, type PendingOp } from './cascading-failures';
import { refreshTokenAttempt } from '../auth/refresh-token-attempt';
import { tokenMutex } from '../auth/token-mutex';
import { createLogger } from '../utils/logger';

const log = createLogger('SyncEngine');

/**
 * Backend wraps every response in `{ message, data, meta, ... }` (see
 * ApiResponse). Axios then surfaces that wrapper as `res.data`. To get to
 * the actual payload we want, we have to read `res.data.data` — typing
 * AxiosResponse with the inner type is a lie that compiles but reads off
 * the wrong layer at runtime. This helper makes the unwrap typed and
 * intentional so call sites can't drift apart.
 */
interface ApiEnvelope<T> {
  message?: string;
  data: T;
}

function unwrapEnvelope<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as ApiEnvelope<T>).data;
  }
  // Backend always wraps. If we ever see a bare payload it's a backend
  // contract change, not a "fall through to the raw shape" case — fail
  // loudly so we notice.
  throw new Error('Unexpected response shape: missing ApiResponse envelope');
}

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

// GET /sync/pull response (single entity, one page)
interface PullResponse {
  server_time: string;    // ISO
  entity:      string;
  has_more:    boolean;
  next_cursor: string;    // "<timestampMs>:<uuid>"
  changes:     SyncChange[];
}

// POST /sync/push — one operation per queued mutation
interface PushOperation {
  client_op_id: string;  // stable idempotency key
  sequence:     number;
  entity:       string;
  operation:    string;
  client_id:    string;  // same as client_op_id
  payload:      Record<string, unknown>;
}

type OpResultStatus = 'ok' | 'duplicate' | 'conflict' | 'rejected' | 'error';

interface PushOpResult {
  client_op_id:  string;
  status:        OpResultStatus;
  reason?:       string;
  server_state?: unknown;
}

interface PushResponse {
  server_time: string;
  results:     PushOpResult[];
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

  // No access token yet (offline-session-only startup) — skip sync.
  // The proactive refresh will produce a valid token; SyncManager will
  // retry when it calls setup() after the auth state updates.
  if (!tokenManager.get()) {
    log.debug('Sync skipped — no access token yet');
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
  // Ensure the DB is open before any repository calls.
  // syncManager.setup() may be called concurrently with initializeDatabase() from
  // auth-provider — this guarantees the DB handle exists before we query it.
  await initializeDatabase();

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
async function pullChanges(_storeGuuid: string): Promise<void> {
  log.info('PULL: Starting...');

  let totalChanges = 0;
  let lastServerTime: string | null = null;

  // One refresh budget per pull run, shared across every entity and every
  // page. Previously this flag was scoped to the inner page-retry loop, so
  // each entity × each page that 403'd issued its own POST /auth/refresh-token
  // (3 entities × 2 pages = 6 refresh hits per single user-initiated sync,
  // which tripped the rate limit on the very endpoint that's supposed to
  // unblock the user). Hoisting it here caps it at one refresh per pull —
  // and `tokenMutex.withRefreshLock` collapses any race with the axios
  // interceptor or proactive timer onto the same in-flight HTTP call.
  let didRetryAfter403 = false;

  // Pull each entity sequentially. The backend exposes GET /sync/pull?entity=X
  // per the spec — one entity per request, compound cursor pagination.
  for (const entity of SYNC_TABLES) {
    const handler = TABLE_HANDLERS[entity];
    if (!handler) continue;

    // Read this entity's cursor from SQLite (0 = never synced → fetch all rows)
    const cursorMs = await syncStateRepository.getCursorForTable(entity);
    let cursor = `${cursorMs}:00000000-0000-0000-0000-000000000000`;

    log.debug(`PULL: entity=${entity} cursor=${cursor}`);

    let pageNum = 0;

    while (true) {
      pageNum++;

      let response: { server_time: string; has_more: boolean; next_cursor: string; changes: SyncChange[] };
      let retryCount = 0;
      const maxRetries = 3;

      while (true) {
        try {
          const res = await API.get('/sync/pull', {
            headers: { 'X-Sync-Schema-Version': SYNC_SCHEMA_VERSION },
            params:  { entity, cursor, limit: PULL_PAGE_SIZE },
            timeout: PULL_TIMEOUT_MS,
          });
          response = unwrapEnvelope<typeof response>(res.data);
          log.debug(`PULL: ${entity} page ${pageNum}: ${response.changes?.length ?? 0} changes, has_more=${response.has_more}`);
          if (pageNum === 1 && response.server_time) {
            lastServerTime = response.server_time;
          }
          break;
        } catch (err) {
          const status = (err as AxiosError).response?.status;
          if (status === 429 && retryCount < maxRetries - 1) {
            const backoffMs = Math.pow(2, retryCount) * 1_000;
            log.warn(`PULL: 429 for ${entity} — retrying in ${backoffMs}ms`);
            await new Promise(r => setTimeout(r, backoffMs));
            retryCount++;
            continue;
          }
          // 403 on a freshly-restored session usually means the backend's
          // device_registration row is missing for the active store.
          // POST /auth/refresh-token re-runs the self-heal upsert
          // (TokenLifecycleService.refreshAccessToken). Await the refresh
          // so the retried pull lands after the device row is in place.
          // Retry only once — a genuinely unauthorized device must not loop.
          if (status === 403 && !didRetryAfter403) {
            log.warn(`PULL: 403 for ${entity} — refreshing session and retrying once`);
            didRetryAfter403 = true;
            // Route through tokenMutex so a parallel axios-interceptor 401
            // refresh, the proactive 5-min refresh timer, or any future
            // caller all share the same in-flight HTTP call. The mutex
            // returns undefined to second-comers — that's the contract:
            // "the lock holder's refresh has already updated tokenManager,
            // just re-read the token". An undefined result here is success
            // by that contract, so we fall through to retry the page.
            const refresh = await tokenMutex.withRefreshLock(() => refreshTokenAttempt());
            if (refresh && !refresh.success) {
              log.warn(`PULL: refresh after 403 failed (${refresh.error}) — aborting`);
              throw new Error('UNAUTHORIZED');
            }
            continue;
          }
          if (status === 403) {
            log.warn(`PULL: 403 for ${entity} after retry — aborting`);
            throw new Error('UNAUTHORIZED');
          }
          log.error(`PULL: failed for ${entity} (status ${status}):`, err);
          throw err;
        }
      }

      // Backend returns id as string; repositories expect number. Coerce here.
      const rawChanges: Array<{ id: string | number; operation: 'upsert' | 'delete'; data: Record<string, unknown> | null }> = response.changes ?? [];

      if (rawChanges.length > 0) {
        const upserts: Array<{ id: number; data: Record<string, unknown> }> = [];
        const deletes: number[] = [];

        for (const change of rawChanges) {
          const numId = Number(change.id);
          if (change.operation === 'upsert' && change.data) {
            upserts.push({ id: numId, data: change.data });
          } else if (change.operation === 'delete') {
            deletes.push(numId);
          }
        }

        // Apply the page atomically from the cursor's point of view: if either
        // batch fails, leave the cursor where it was so the next sync re-fetches
        // this page. Advancing past a failed write would silently drop those rows.
        try {
          if (upserts.length) await handler.onBatchUpsert(upserts);
          if (deletes.length) await handler.onBatchDelete(deletes);
        } catch (err) {
          log.error(`PULL: failed to apply page for ${entity} — leaving cursor at ${cursor} for retry`, err);
          break;
        }

        totalChanges += rawChanges.length;

        // Advance cursor only after a successful page apply.
        const nextCursor = response.next_cursor;
        const nextMs = parseInt(nextCursor.split(':')[0] ?? '0', 10);
        if (!isNaN(nextMs) && nextMs > 0) {
          cursor = nextCursor;
          await syncStateRepository.saveCursorForTable(entity, nextMs);
        }
      }

      if (!response.has_more) break;
    }

    log.debug(`PULL: ${entity} done — ${pageNum} page(s)`);
  }

  // Write last pull time using server clock
  const pullTimestamp = lastServerTime
    ? new Date(lastServerTime).getTime()
    : Date.now();
  await syncStateRepository.setValue(SYNC_KEYS.LAST_PULL_AT, String(pullTimestamp));

  log.info(`PULL: Applied ${totalChanges} changes across ${SYNC_TABLES.length} entity type(s)`);
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

  const [identity] = await Promise.all([
    getDeviceIdentity(),
    offlineSession.load(), // kept for future offline-session header use
  ]);
  const deviceId = identity.deviceId;

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

    const operations: PushOperation[] = batch.map((item, idx) => ({
      client_op_id: item.idempotency_key,
      sequence:     idx + 1,
      entity:       item.entity,
      operation:    item.operation,
      client_id:    item.idempotency_key,
      payload:      item.payload,
    }));

    const body: Record<string, unknown> = {
      device_id: deviceId,
      operations,
    };

    try {
      const res = await API.post('/sync/push', body, {
        headers: { 'X-Sync-Schema-Version': SYNC_SCHEMA_VERSION },
        timeout: PUSH_TIMEOUT_MS,
      });

      // Previously this used API.post<PushResponse> and read res.data.results
      // directly. That was a contract bug: AxiosResponse types `res.data` as
      // the generic, but the wire shape is `{ message, data: PushResponse }`,
      // so `res.data.results` was always undefined and the result-processing
      // loop below silently no-op'd — every push round-tripped without ever
      // calling markSynced. The server-side idempotency dedup hid this from
      // users; the local queue just looked perpetually pending.
      const push = unwrapEnvelope<PushResponse>(res.data);
      const results    = push.results ?? [];
      const serverTime = push.server_time;

      // Build lookups for the result-processing loop
      const opIdToItem   = new Map(batch.map(item => [item.idempotency_key, item]));
      const opIdToRowId  = new Map(batch.map(item => [item.idempotency_key, item.id]));
      const handledRowIds = new Set<number>();

      // Collect failed parent ops so we can cascade-fail their dependents after the loop
      const failedParents: Array<{ clientId: string; entity: string }> = [];

      for (const result of results) {
        const rowId = opIdToRowId.get(result.client_op_id);
        if (rowId == null) continue;
        handledRowIds.add(rowId);

        if (result.status === 'ok' || result.status === 'duplicate') {
          await mutationQueueRepository.markSynced([rowId]);
          totalPushed++;
          continue;
        }

        if (result.status === 'conflict') {
          const serverState = (result.server_state as Record<string, unknown>) ?? null;
          await resolveConflict(rowId, serverState, result.reason ?? 'conflict');
          const batchItem = opIdToItem.get(result.client_op_id);
          if (batchItem) failedParents.push({ clientId: result.client_op_id, entity: batchItem.entity });
          log.warn(`PUSH: Conflict ${result.client_op_id}: ${result.reason ?? ''}`);
          continue;
        }

        if (result.status === 'rejected') {
          await mutationQueueRepository.markQuarantined(rowId, 400, result.reason ?? 'rejected');
          const batchItem = opIdToItem.get(result.client_op_id);
          if (batchItem) failedParents.push({ clientId: result.client_op_id, entity: batchItem.entity });
          log.warn(`PUSH: Rejected ${result.client_op_id}: ${result.reason ?? ''}`);
          continue;
        }

        if (result.status === 'error') {
          await mutationQueueRepository.incrementRetry(rowId, result.reason ?? 'SERVER_ERROR');
          log.debug(`PUSH: Error ${result.client_op_id}: ${result.reason ?? ''}`);
          continue;
        }
      }

      // Cascade-fail any pending ops that depended on a failed parent
      if (failedParents.length > 0) {
        const unhandledOps: PendingOp[] = batch
          .filter(item => !handledRowIds.has(item.id))
          .map(item => ({
            id:              item.id,
            idempotency_key: item.idempotency_key,
            entity:          item.entity,
            operation:       item.operation,
            payload:         item.payload,
          }));

        for (const failed of failedParents) {
          await scanCascadingFailures(failed.clientId, failed.entity, unhandledOps);
        }
      }

      // Any ops the server didn't mention — reset to pending
      const unhandledIds = batch
        .filter(item => !handledRowIds.has(item.id))
        .map(item => item.id);
      if (unhandledIds.length > 0) {
        await mutationQueueRepository.resetToRetry(unhandledIds);
        log.warn(`PUSH: ${unhandledIds.length} mutations not in server response — returned to retry queue`);
        return;
      }

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

