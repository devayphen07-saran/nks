/**
 * writeWithQueue — atomic domain write + mutation queue enqueue.
 *
 * Every offline-first write goes through this helper. It wraps the domain
 * INSERT/UPDATE/DELETE and the sync_queue INSERT in a single SQLite
 * transaction, so either both succeed or neither does.
 *
 * If the device writes a row but the queue insert fails, the server would
 * never receive the change. This helper prevents that split-brain state.
 *
 * Usage:
 *   await writeWithQueue({
 *     entity:    'customer',
 *     operation: 'create',
 *     payload:   { guuid, name, phone, store_id },
 *     priority:  MutationPriority.NORMAL,
 *     write: (tx) => tx.insert(customer).values({ ... }),
 *   });
 */

import { getDatabase } from './connection';
import { mutationQueue } from './schema';
import { getDeviceIdentity } from '../device/device-binding';
import { createLogger } from '../utils/logger';
import { uuidv7 } from 'uuidv7';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import type * as schema from './schema';
import { MutationPriority } from './repositories/mutation-queue.repository';
import type { MutationPriorityLevel } from './repositories/mutation-queue.repository';

const log = createLogger('WriteWithQueue');

type Tx = ExpoSQLiteDatabase<typeof schema>;

export interface WriteWithQueueOptions {
  /** Entity name as registered with the sync dispatcher (e.g. 'customer', 'sale'). */
  entity: string;
  /** CRUD operation type. */
  operation: 'create' | 'update' | 'delete';
  /**
   * The payload sent to the server in the mutation queue.
   * For create: full row data.
   * For update: changed fields + guuid + expected_version.
   * For delete: { guuid, expected_version }.
   */
  payload: Record<string, unknown>;
  /** Queue priority. Defaults to NORMAL (5). */
  priority?: MutationPriorityLevel;
  /** Max retries before quarantine. Defaults to 5. */
  maxRetries?: number;
  /** The domain write to run inside the transaction. */
  write: (tx: Tx) => Promise<unknown>;
}

/**
 * Executes a domain write and queues the corresponding mutation atomically.
 *
 * @throws If either the domain write or the queue insert fails.
 *         The transaction rolls back automatically on any error.
 */
export async function writeWithQueue(options: WriteWithQueueOptions): Promise<void> {
  const {
    entity,
    operation,
    payload,
    priority = MutationPriority.NORMAL,
    maxRetries = 5,
    write,
  } = options;

  const db = getDatabase();
  const identity = await getDeviceIdentity();
  const idempotencyKey = uuidv7();

  await db.transaction(async (tx) => {
    // Step 1: Execute the domain write (INSERT / UPDATE / UPDATE for soft-delete)
    await write(tx as Tx);

    // Step 2: Enqueue the mutation for push sync
    await tx.insert(mutationQueue).values({
      idempotency_key: idempotencyKey,
      client_op_id:    idempotencyKey,
      operation,
      entity,
      payload:     JSON.stringify(payload),
      status:      'pending',
      priority,
      retries:     0,
      max_retries: maxRetries,
      device_id:   identity.deviceId,
      created_at:  Date.now(),
    });
  });

  log.debug(`writeWithQueue: ${operation} ${entity} queued (key=${idempotencyKey})`);
}
