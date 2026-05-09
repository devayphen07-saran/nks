/**
 * DeviceContext identifies the authenticated device making a sync request.
 *
 * Populated by DeviceAuthGuard (Phase 4) after verifying:
 * - Bearer token is valid (global AuthGuard)
 * - X-Device-Id header is present
 * - Device is registered to the user's active store
 *
 * Passed to all sync operations (push/pull) for multi-tenancy and device tracking.
 */
export interface DeviceContext {
  deviceId: string; // Stable UUID generated on mobile at first launch
  userId: number; // Internal bigint ID from users table
  storeId: number; // Internal bigint ID from store table (user's active store)
}
