/**
 * SyncOperation is a single inbound operation from a mobile device.
 *
 * Mobile generates clientOpId (UUID) on the device. If the device crashes
 * mid-push or the network flakes, the same operation may be submitted
 * multiple times. Idempotency service deduplicates by clientOpId.
 *
 * clientId is the UUID of the entity being created/updated/deleted.
 * This is the stable identifier mobile uses (guuid column).
 *
 * The backend converts clientId ↔ internal id before database operations.
 * Payload shape depends on entity and operation — validated by domain handler.
 */
export interface SyncOperation {
  client_op_id: string; // UUID, generated on device
  sequence: number; // Ordering within the batch (1-indexed)
  entity: string; // Entity type: 'customer', 'product', 'sale', etc.
  operation: 'create' | 'update' | 'delete';
  client_id: string; // UUID of the entity being modified
  payload: Record<string, unknown>; // Shape validated by domain handler
}
