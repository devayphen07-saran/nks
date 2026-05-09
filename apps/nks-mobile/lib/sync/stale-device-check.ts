/**
 * Stale Device Check
 *
 * Detects when the device's sync cursors are too far behind the server.
 * If any table cursor is older than STALE_THRESHOLD_DAYS, the device is
 * considered stale and should do a full rebootstrap.
 *
 * Called once on app launch after initializeSyncEngine().
 *
 * Usage:
 *   const isStale = await isDeviceStale();
 *   if (isStale) await fullRebootstrap(storeGuuid);
 */

import { SYNC_TABLES } from './sync-table-handlers';
import { syncStateRepository } from '../database/repositories/sync-state.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('StaleDeviceCheck');

const STALE_THRESHOLD_DAYS = 90;
const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Returns true if the oldest non-zero table cursor is older than 90 days.
 * Tables with cursor = 0 (never synced) are skipped — they are not stale,
 * they just need a first pull.
 */
export async function isDeviceStale(): Promise<boolean> {
  const cursors = await Promise.all(
    SYNC_TABLES.map((table) => syncStateRepository.getCursorForTable(table)),
  );

  const syncedCursors = cursors.filter((cursor) => cursor > 0);

  if (syncedCursors.length === 0) {
    log.debug('No synced tables — device is new, not stale');
    return false;
  }

  const oldestCursor = Math.min(...syncedCursors);
  const ageMs = Date.now() - oldestCursor;
  const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  if (ageMs > STALE_THRESHOLD_MS) {
    log.warn(`Device is stale — oldest cursor is ${ageDays} days old (threshold: ${STALE_THRESHOLD_DAYS})`);
    return true;
  }

  log.debug(`Device is fresh — oldest cursor is ${ageDays} days old`);
  return false;
}
