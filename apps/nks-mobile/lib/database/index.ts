// ─── Connection ───────────────────────────────────────────────────────────────
export { initializeDatabase, closeDatabase, getDatabase, isDatabaseReady, wasWipedOnStartup } from './connection';

// ─── Atomic Write Helper ──────────────────────────────────────────────────────
export { writeWithQueue } from './write-with-queue';
export type { WriteWithQueueOptions } from './write-with-queue';

// ─── Repositories ─────────────────────────────────────────────────────────────
export {
  syncStateRepository,
  mutationQueueRepository,
  stateRepository,
  districtRepository,
  lookupRepository,
} from './repositories';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStateRow,
  MutationQueueRow,
  InsertMutationQueue,
  StateRow,
  DistrictRow,
  LookupRow,
} from './schema';

export type { MutationQueueItem } from './repositories';
