/**
 * Full Rebootstrap
 *
 * Wipes all local data and runs a full pull from the server.
 * Used when:
 *   - Device cursor is stale (> 90 days behind)
 *   - Remote wipe is triggered by backend
 *   - User manually requests a full resync
 *
 * Usage:
 *   await fullRebootstrap(storeGuuid);
 */

import { clearAllTables } from '../local-db';
import { runPullOnly } from './sync-engine';
import { createLogger } from '../utils/logger';

const log = createLogger('FullRebootstrap');

let _isRunning = false;

/**
 * Wipe all local tables and pull fresh data from the server.
 * Guards against concurrent runs.
 */
export async function fullRebootstrap(storeGuuid: string): Promise<void> {
  if (_isRunning) {
    log.warn('Rebootstrap already in progress — skipping');
    return;
  }

  _isRunning = true;
  log.warn(`Starting full rebootstrap for store: ${storeGuuid}`);

  try {
    await clearAllTables();
    log.info('Local tables cleared');

    await runPullOnly(storeGuuid);
    log.info('Full pull complete — rebootstrap done');
  } catch (err) {
    log.error('Rebootstrap failed:', err);
    throw err;
  } finally {
    _isRunning = false;
  }
}

export function isRebootstrapping(): boolean {
  return _isRunning;
}
