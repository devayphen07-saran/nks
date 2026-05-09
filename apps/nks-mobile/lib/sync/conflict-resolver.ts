/**
 * ConflictResolver
 *
 * Handles the 'conflict' result from the server push response.
 *
 * A conflict means the server rejected the mutation because the row's version
 * on the server doesn't match what the client sent. The server includes its
 * current state (`server_state`) so the user can see what changed.
 *
 * What this does:
 *   1. Moves the conflicted mutation to failed_operations with server_state preserved
 *   2. The dead-letter UI (DeadLetterScreen) shows the conflict to the user
 *   3. User manually resolves: keep local edit (re-queue with latest version)
 *      or discard local edit (pull from server on next sync)
 *
 * Usage:
 *   await conflictResolver.resolve(mutationRow, serverState, reason);
 */

import { mutationQueueRepository } from '../database/repositories/mutation-queue.repository';
import { failedOperationsRepository } from '../database/repositories/failed-operations.repository';
import { getDatabase } from '../database/connection';
import { mutationQueue } from '../database/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const log = createLogger('ConflictResolver');

/**
 * Quarantine a conflicted mutation, preserving the server's current state.
 *
 * @param mutationId   - The SQLite id of the mutation_queue row
 * @param serverState  - The server's current version of the row (from push response)
 * @param reason       - Human-readable reason from the server
 */
export async function resolveConflict(
  mutationId: number,
  serverState: Record<string, unknown> | null,
  reason: string,
): Promise<void> {
  try {
    const rows = await getDatabase()
      .select()
      .from(mutationQueue)
      .where(eq(mutationQueue.id, mutationId))
      .limit(1);

    if (!rows[0]) {
      log.warn(`resolveConflict: mutation id=${mutationId} not found`);
      return;
    }

    const row = rows[0];

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
      error_code:      409,
      error_msg:       reason,
      server_state:    serverState,
      device_id:       row.device_id,
      created_at:      row.created_at,
    });

    // Remove from active queue — it is now in the dead-letter store
    await getDatabase()
      .delete(mutationQueue)
      .where(eq(mutationQueue.id, mutationId));

    log.warn(`Conflict quarantined: id=${mutationId} entity=${row.entity} op=${row.operation} — ${reason}`);
  } catch (err) {
    log.error(`resolveConflict failed for id=${mutationId}:`, err);
    // Fall back to generic quarantine so the op is not lost
    await mutationQueueRepository.markQuarantined(mutationId, 409, reason);
  }
}
