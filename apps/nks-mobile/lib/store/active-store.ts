/**
 * Single entry point for setting the active store in Redux.
 *
 * Looks up the store name from local SQLite (populated by the login bootstrap
 * or by store creation) so callers don't have to remember to pass it. Falls
 * back to an empty name only when the store row is genuinely missing — that
 * is a real edge case (race between creation and navigation) and deserves a
 * log line, not a silent default.
 */

import { setActiveStore } from '@nks/state-manager';
import type { AppDispatch } from '../../store';
import { storesRepository } from '../database/repositories/stores.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('ActiveStore');

export async function setActiveStoreByGuuid(
  dispatch: AppDispatch,
  storeGuuid: string,
): Promise<void> {
  const row = await storesRepository.findByGuuid(storeGuuid);
  if (!row) {
    log.warn(`setActiveStoreByGuuid: store ${storeGuuid} not in local DB yet`);
    dispatch(setActiveStore({ guuid: storeGuuid, name: '' }));
    return;
  }
  dispatch(setActiveStore({ guuid: storeGuuid, name: row.name }));
}
