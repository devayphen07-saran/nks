// ─── Connection ───────────────────────────────────────────────────────────────
export { initializeDatabase, closeDatabase, getDatabase, isDatabaseReady, wasWipedOnStartup } from './connection';

// ─── Repositories ─────────────────────────────────────────────────────────────
export {
  syncStateRepository,
  mutationQueueRepository,
  stateRepository,
  districtRepository,
} from './repositories';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncStateRow,
  MutationQueueRow,
  InsertMutationQueue,
  StateRow,
  DistrictRow,
} from './schema';

export type { MutationQueueItem } from './repositories';
