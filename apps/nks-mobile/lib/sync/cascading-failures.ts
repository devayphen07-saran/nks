/**
 * Cascading Failures Scanner
 *
 * When a parent mutation is rejected or conflicts, any pending mutations that
 * reference the same entity ID should be pre-marked as failed immediately —
 * rather than sending them to the server and getting another error back.
 *
 * Example:
 *   sale_create (client_id: "abc") → rejected
 *   sale_item_create (payload.sale_id: "abc") → pre-marked failed (would fail anyway)
 *   payment_create  (payload.sale_id: "abc") → pre-marked failed (would fail anyway)
 *
 * How entity IDs are linked:
 *   The payload of each mutation carries the parent entity ID in a predictable field.
 *   PARENT_ID_FIELDS maps entity → the field name in its payload that holds the parent ID.
 *   When a parent op fails, we scan pending ops for any that reference the parent's
 *   client_id in those fields.
 *
 * Usage:
 *   await scanCascadingFailures(failedClientId, failedEntity, pendingOps);
 */

import { getDatabase } from '../database/connection';
import { mutationQueue } from '../database/schema';
import { inArray } from 'drizzle-orm';
import { failedOperationsRepository } from '../database/repositories/failed-operations.repository';
import { createLogger } from '../utils/logger';

const log = createLogger('CascadingFailures');

/**
 * Maps each entity to the payload field names that reference a parent entity ID.
 * Add entries here as new domain entities are introduced.
 *
 * Key   = entity whose mutations may reference a parent
 * Value = payload field(s) that hold the parent's client_id
 */
const PARENT_ID_FIELDS: Record<string, string[]> = {
  sale_item: ['sale_id'],
  payment:   ['sale_id'],
};

export interface PendingOp {
  id:              number;
  idempotency_key: string;
  entity:          string;
  operation:       string;
  payload:         Record<string, unknown>;
}

/**
 * Scan pending ops and pre-fail any that depend on a failed parent mutation.
 *
 * @param failedClientId - The client_id from the failed parent mutation's payload
 * @param failedEntity   - The entity type of the failed parent (e.g. 'sale')
 * @param pendingOps     - The remaining pending ops in the current batch window
 */
export async function scanCascadingFailures(
  failedClientId: string,
  failedEntity: string,
  pendingOps: PendingOp[],
): Promise<void> {
  if (!failedClientId || pendingOps.length === 0) return;

  const dependentIds: number[] = [];

  for (const op of pendingOps) {
    const parentFields = PARENT_ID_FIELDS[op.entity];
    if (!parentFields) continue;

    const referencesFailedParent = parentFields.some(
      (field) => op.payload[field] === failedClientId,
    );

    if (referencesFailedParent) {
      dependentIds.push(op.id);
      log.warn(
        `Cascading failure: ${op.entity}/${op.operation} id=${op.id} depends on failed ${failedEntity} id=${failedClientId}`,
      );
    }
  }

  if (dependentIds.length === 0) return;

  // Move each dependent op to the dead-letter store
  const db = getDatabase();
  const rows = await db
    .select()
    .from(mutationQueue)
    .where(inArray(mutationQueue.id, dependentIds));

  for (const row of rows) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    await failedOperationsRepository.insert({
      idempotency_key: row.idempotency_key,
      operation:       row.operation,
      entity:          row.entity,
      payload,
      error_code:      0,
      error_msg:       `Cascading failure: parent ${failedEntity} (id=${failedClientId}) was rejected`,
      server_state:    null,
      device_id:       row.device_id,
      created_at:      row.created_at,
    });
  }

  await db
    .delete(mutationQueue)
    .where(inArray(mutationQueue.id, dependentIds));

  log.warn(`Pre-failed ${dependentIds.length} dependent mutation(s) due to ${failedEntity} rejection`);
}
