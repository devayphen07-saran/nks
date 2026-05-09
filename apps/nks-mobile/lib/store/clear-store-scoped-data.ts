/**
 * Wipes a store's per-store rows from the local database.
 *
 * Called only AFTER the next store has been fully replicated and activated.
 * Order matters: if we cleared the old store before the new one's pull
 * completed and replication then failed, the user would be left with no
 * data on either store. By running this last, a failure here at worst
 * leaves the previous store's rows lingering on disk — the new store is
 * already live and usable.
 *
 * What gets deleted:
 *   - lookup rows with store_id = X (global rows where store_id IS NULL stay)
 *   - roles, permissions, role_permissions, user_store_roles for store X
 *   - permission_constraints for store X
 *   - store_data_staging leftovers for store X
 *
 * What is preserved:
 *   - state, district, global lookups
 *   - the stores row itself (so the user can switch back)
 *   - sync_metadata, store_sync_progress (resume info)
 *   - mutation_queue (must be flushed to server, not deleted)
 *   - store_cache (history)
 */

import { lookupRepository } from '../database/repositories/lookup.repository';
import { rolesRepository } from '../database/repositories/roles.repository';
import { permissionConstraintsRepository } from '../database/repositories/permission-constraints.repository';
import { stagingRepository } from '../database/repositories/staging.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('ClearStoreData');

export async function clearStoreScopedData(storeId: number): Promise<void> {
  log.info(`Clearing scoped data for store ${storeId}`);

  await lookupRepository.deleteByStoreId(storeId);
  await rolesRepository.deleteByStoreId(storeId);
  await permissionConstraintsRepository.deleteByStoreId(storeId);
  await stagingRepository.rollback(storeId);

  log.info(`Cleared scoped data for store ${storeId}`);
}
