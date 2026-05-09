/**
 * SyncManager
 *
 * The single public API for triggering sync from the rest of the app.
 * All sync calls go through here — never call sync-engine directly from UI code.
 *
 * Usage:
 *   syncManager.requestSync();           // debounced, safe to call rapidly
 *   await syncManager.forceSync();       // immediate, awaitable
 *   await syncManager.ensureEmptyQueue(30_000);  // wait up to 30s for queue drain
 */

import {
  runSync,
  runPushOnly,
  isSyncing,
  getLastSyncedAt,
  setActiveStoreGuuid,
  initializeSyncEngine,
} from './sync-engine';
import { fullRebootstrap } from './full-rebootstrap';
import { isDeviceStale } from './stale-device-check';
import { networkMonitor } from './network-monitor';
import { mutationQueueRepository } from '../database/repositories/mutation-queue.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('SyncManager');

const DEBOUNCE_DELAY_MS = 3_000;
const ENSURE_QUEUE_POLL_MS = 1_000;

let _storeGuuid: string | null = null;
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Setup ────────────────────────────────────────────────────────────────────

/**
 * Initialize the sync manager for a store.
 * Call once after login or store switch.
 * Starts the network monitor and checks for a stale device.
 */
async function setup(storeGuuid: string): Promise<void> {
  _storeGuuid = storeGuuid;
  setActiveStoreGuuid(storeGuuid);

  await initializeSyncEngine();

  const stale = await isDeviceStale();
  if (stale) {
    log.warn('Device is stale — running full rebootstrap');
    await fullRebootstrap(storeGuuid);
    return;
  }

  networkMonitor.start(() => {
    log.info('Back online — triggering sync');
    requestSync();
  });

  log.info(`SyncManager ready for store: ${storeGuuid}`);

  // Kick off an initial sync so reference/lookup data is pulled immediately
  // after login or store switch. Without this, the first sync only fires
  // on the 5-minute periodic timer in auth-provider.
  _runSync('setup').catch((err) => {
    log.error('Initial sync after setup failed:', err);
  });
}

/**
 * Tear down on logout. Stops the network monitor and clears state.
 */
function teardown(): void {
  networkMonitor.stop();
  _storeGuuid = null;

  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  log.info('SyncManager torn down');
}

// ─── Sync Triggers ────────────────────────────────────────────────────────────

/**
 * Request a sync. Debounced — safe to call after every local write.
 * Collapses rapid calls into a single sync after the debounce window.
 * Fire-and-forget: errors are logged, not thrown.
 */
function requestSync(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer);

  _debounceTimer = setTimeout(() => {
    _debounceTimer = null;
    _runSync('debounced');
  }, DEBOUNCE_DELAY_MS);
}

/**
 * Force an immediate sync, bypassing the debounce.
 * Awaitable — resolves when the sync cycle completes.
 * Throws if sync fails.
 */
async function forceSync(): Promise<void> {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }

  await _runSync('forced');
}

/**
 * Push-only sync — use after enqueueing a critical mutation
 * that should not wait for the next full pull+push cycle.
 * Fire-and-forget.
 */
function flushQueue(): void {
  runPushOnly().catch((err) => {
    log.error('Queue flush failed:', err);
  });
}

// ─── Queue Management ─────────────────────────────────────────────────────────

/**
 * Wait until the mutation queue is empty or the timeout is reached.
 * Used at day-close to ensure all sales/payments are synced before closing.
 *
 * @returns { success: true } if queue drained within timeout
 * @returns { success: false, pendingCount: N } if timeout reached with N ops still pending
 */
async function ensureEmptyQueue(
  timeoutMs: number,
): Promise<{ success: boolean; pendingCount: number }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const pending = await mutationQueueRepository.countByStatus('pending');
    const inProgress = await mutationQueueRepository.countByStatus('in_progress');

    if (pending === 0 && inProgress === 0) {
      log.info('Queue empty — all mutations synced');
      return { success: true, pendingCount: 0 };
    }

    log.debug(`Queue not empty: ${pending} pending, ${inProgress} in_progress — pushing`);

    if (!isSyncing()) {
      await runPushOnly().catch((err) => {
        log.warn('Push during ensureEmptyQueue failed:', err);
      });
    }

    await _sleep(ENSURE_QUEUE_POLL_MS);
  }

  const remaining =
    (await mutationQueueRepository.countByStatus('pending')) +
    (await mutationQueueRepository.countByStatus('in_progress'));

  log.warn(`ensureEmptyQueue timed out with ${remaining} mutations still pending`);
  return { success: false, pendingCount: remaining };
}

// ─── Observability ────────────────────────────────────────────────────────────

function getStatus() {
  return {
    storeGuuid: _storeGuuid,
    isSyncing: isSyncing(),
    isOnline: networkMonitor.isOnline(),
    lastSyncedAt: getLastSyncedAt(),
  };
}

// ─── Internals ────────────────────────────────────────────────────────────────

async function _runSync(reason: string): Promise<void> {
  if (!_storeGuuid) {
    log.debug(`Sync skipped (${reason}) — no active store`);
    return;
  }

  if (!networkMonitor.isOnline()) {
    log.debug(`Sync skipped (${reason}) — device offline`);
    return;
  }

  try {
    log.debug(`Starting sync (${reason})`);
    await runSync(_storeGuuid);
  } catch (err) {
    log.error(`Sync failed (${reason}):`, err);
    if (reason === 'forced') throw err;
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const syncManager = {
  setup,
  teardown,
  requestSync,
  forceSync,
  flushQueue,
  ensureEmptyQueue,
  getStatus,
};
