/**
 * @deprecated Import directly from './database' instead.
 * This file exists only for backward-compatibility with existing imports.
 */

// ─── Connection ───────────────────────────────────────────────────────────────
export { initializeDatabase, closeDatabase, getDatabase, isDatabaseReady, wasWipedOnStartup } from './database';

// ─── Repositories ─────────────────────────────────────────────────────────────
export {
  syncStateRepository,
  mutationQueueRepository,
  stateRepository,
  districtRepository,
} from './database';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStateRow,
  MutationQueueRow,
  MutationQueueItem,
  StateRow,
  DistrictRow,
} from './database';

// ─── Legacy shims ─────────────────────────────────────────────────────────────
import { syncStateRepository } from './database';
import { mutationQueueRepository } from './database';

/** @deprecated Use syncStateRepository.getCursor() */
export const getCursor    = () => syncStateRepository.getCursor();
/** @deprecated Use syncStateRepository.saveCursor(ms) */
export const saveCursor   = (ms: number) => syncStateRepository.saveCursor(ms);
/** @deprecated Use mutationQueueRepository.findBatch(limit) */
export const getMutationQueueBatch  = (limit?: number) => mutationQueueRepository.findBatch(limit);
/** @deprecated Use mutationQueueRepository.markSynced(ids) */
export const deleteMutationsById    = (ids: number[]) => mutationQueueRepository.markSynced(ids);
/** @deprecated Use mutationQueueRepository.incrementRetry(id) */
export const incrementMutationRetry = (id: number) => mutationQueueRepository.incrementRetry(id);

// ─── clearAllTables (used by reconnection-handler + logout-thunk) ─────────────
import {
  isDatabaseReady,
  syncStateRepository as _ss,
  mutationQueueRepository as _mq,
  stateRepository as _state,
  districtRepository as _district,
} from './database';
import { createLogger } from './utils/logger';

const log = createLogger('LocalDB');

export async function clearAllTables(): Promise<void> {
  if (!isDatabaseReady()) {
    log.info('Database not initialized — skipping table clear');
    return;
  }
  try {
    await Promise.all([
      _state.clear(),
      _district.clear(),
      _ss.clear(),
      _mq.clear(),
    ]);
    log.info('All tables cleared');
  } catch (err) {
    log.error('Failed to clear tables:', err);
  }
}
