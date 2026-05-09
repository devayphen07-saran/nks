/**
 * Binds the current session to a different store on the backend.
 *
 * Calls POST /auth/switch-store, which atomically:
 *   - Updates user_session.active_store_fk to the new store
 *   - Upserts a device_registration row for (deviceId, userId, newStoreId)
 *
 * Without this call, /sync/pull?storeId=B returns 403 because DeviceAuthGuard
 * cannot find a registration row for the (device, user, B) triple.
 *
 * Used by the store-switch flow before replicating the new store. Not used
 * after store creation — the backend's POST /stores already updates the
 * session and registers the device atomically.
 */

import { API } from '@nks/api-manager';
import type { SwitchStoreRequest, SwitchStoreResponse } from '@nks/api-manager';
import { createLogger } from '../utils/logger';

const log = createLogger('SwitchActiveStore');

const SWITCH_STORE_PATH = '/auth/switch-store';
const SWITCH_STORE_TIMEOUT_MS = 10_000;

export async function switchActiveStoreOnServer(storeId: number): Promise<void> {
  const body: SwitchStoreRequest = { storeId };
  const res = await API.post<SwitchStoreResponse>(SWITCH_STORE_PATH, body, {
    timeout: SWITCH_STORE_TIMEOUT_MS,
  });
  log.info(`Session bound to store ${res.data.data.activeStoreId}`);
}
