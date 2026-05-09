import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { IdempotencyService } from './services/idempotency.service';
import { DispatcherService } from './services/dispatcher.service';
import { SyncCursorService } from './services/sync-cursor.service';
import { DEFAULT_PULL_LIMIT } from './sync.constants';
import {
  TransactionService,
  type DbTransaction,
} from '../../core/database/transaction.service';
import type { DeviceContext } from './types/device-context';
import type { SyncResult } from './types/sync-result';
import type { SyncOperation } from './types/sync-operation';

/**
 * SyncService orchestrates push and pull operations for offline-first sync.
 *
 * Push (applyOperation):
 *   1. Check idempotency cache → return cached result if found
 *   2. Verify handler exists → return error (not cached) if unknown entity
 *   3. Execute operation inside transaction
 *   4. Cache ONLY terminal results (ok, duplicate, conflict, rejected)
 *   5. Errors are NOT cached → client can retry
 *
 * Pull (pullEntity):
 *   1. Look up handler → throw BadRequestException if unknown entity
 *   2. Parse cursor (timestamp:uuid format)
 *   3. Execute in REPEATABLE READ transaction
 *   4. Capture server_time at transaction start (for consistency)
 *   5. Fetch paginated changes using compound cursor
 *   6. Return changes with next_cursor for pagination
 *
 * Key Behaviors:
 *   - Idempotency key: client_op_id (mobile-generated UUID)
 *   - Terminal results: ok, duplicate, conflict, rejected
 *   - Non-cached: error, unknown_entity
 *   - Isolation: REPEATABLE READ ensures server_time and data are consistent
 *   - Pagination: limit+1 to detect has_more, compound cursor handles same updated_at
 *   - Multi-tenancy: all queries filtered by device.storeId
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly tx: TransactionService,
    private readonly idempotency: IdempotencyService,
    private readonly dispatcher: DispatcherService,
    private readonly cursorService: SyncCursorService,
  ) {}

  /**
   * Apply a single sync operation (create/update/delete) with idempotency.
   *
   * Guarantees idempotency: if the device sends the same operation twice,
   * the second request returns the cached result from the first attempt.
   *
   * Result caching:
   *   - Terminal results (ok, duplicate, conflict, rejected) are cached
   *   - Errors are NOT cached (client can retry after fix)
   *   - Unknown entities are NOT cached (client retries after server deploys handler)
   *
   * @param op - Sync operation (client_op_id, entity, operation, client_id, payload)
   * @param device - Device context (deviceId, userId, storeId)
   * @returns SyncResult discriminated union
   *   - ok: operation succeeded, server_id and version set
   *   - duplicate: UUID collision on create
   *   - conflict: version mismatch on update/delete, server_state included
   *   - rejected: validation failed, not retryable
   *   - error: transient error (DB, network), client retries with backoff
   */
  async applyOperation(
    op: SyncOperation,
    device: DeviceContext,
  ): Promise<SyncResult> {
    // Step 1: Check idempotency cache
    // If we've seen this client_op_id before, return the cached result immediately
    const cached = await this.idempotency.find(op.client_op_id);
    if (cached) {
      this.logger.debug(
        `[Sync] Idempotency HIT: ${op.entity} ${op.client_op_id} → ${cached.status}`,
      );
      return cached;
    }

    // Step 2: Verify handler exists BEFORE opening transaction
    // Unknown entity errors are intentionally NOT cached, so the device can retry
    // after the server deploys the handler
    const handler = this.dispatcher.getHandler(op.entity);
    if (!handler) {
      const result: SyncResult = {
        status: 'error',
        client_op_id: op.client_op_id,
        reason: `Unknown entity: ${op.entity}`,
      };
      this.logger.warn(
        `[Sync] Unknown entity '${op.entity}' in operation ${op.client_op_id} (device: ${device.deviceId}, user: ${device.userId})`,
      );
      // Intentionally NOT cached
      return result;
    }

    // Step 3: Execute operation inside transaction
    // Handler is responsible for implementing operation dispatch (create/update/delete)
    // and managing its own error handling. We catch any uncaught exceptions.
    let result: SyncResult;
    try {
      result = await this.tx.run(
        async (tx: DbTransaction) => handler.apply(op, device, tx),
        { name: `Sync.applyOperation:${op.entity}:${op.operation}` },
      );
    } catch (err) {
      // Transient error (DB timeout, constraint violation not caught by handler, etc.)
      // Not cached. Device retries safely with exponential backoff.
      const errorMessage = err instanceof Error ? err.message : String(err);
      const result: SyncResult = {
        status: 'error',
        client_op_id: op.client_op_id,
        reason: `Transient error during ${op.operation}: ${errorMessage}`,
      };
      this.logger.error(
        `[Sync] Error applying ${op.entity} ${op.operation} ${op.client_op_id} (device: ${device.deviceId}, store: ${device.storeId}): ${errorMessage}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Intentionally NOT cached
      return result;
    }

    // Step 4: Cache ONLY terminal results
    // Terminal results are: ok, duplicate, conflict, rejected
    // Errors are NOT cached because they're transient and device should retry
    if (
      result.status === 'ok' ||
      result.status === 'duplicate' ||
      result.status === 'conflict' ||
      result.status === 'rejected'
    ) {
      await this.idempotency.save(
        op.client_op_id,
        device.deviceId,
        op.entity,
        result,
      );
      this.logger.debug(
        `[Sync] Cached result for ${op.entity} ${op.client_op_id}: ${result.status}`,
      );
    } else {
      this.logger.debug(
        `[Sync] NOT caching error result for ${op.entity} ${op.client_op_id}: ${result.status}`,
      );
    }

    this.logger.log(
      `[Sync] Operation complete: ${op.entity} ${op.operation} ${op.client_op_id} → ${result.status}`,
    );

    return result;
  }

  /**
   * Fetch changes for an entity since a cursor (pull operation).
   *
   * Executes in REPEATABLE READ isolation level to ensure that server_time and
   * the data snapshot are from the same point in time. This prevents race conditions
   * where data changes after the timestamp is captured but before rows are fetched.
   *
   * Pagination:
   *   - Fetches limit+1 rows internally to detect if there are more changes
   *   - Returns limit rows to the client
   *   - next_cursor points to the last returned row for resuming pagination
   *   - Compound cursor (timestamp:uuid) handles multiple rows with same updated_at
   *
   * Multi-tenancy:
   *   - All queries filtered by device.storeId
   *   - Returns only data the device's store can see
   *
   * @param entity - Entity type to pull (e.g., 'product', 'customer', 'sale')
   * @param cursor - Pagination cursor from previous pull (null = start from beginning)
   *                 Format: '<timestamp_ms>:<uuid>' or null/undefined for initial pull
   * @param device - Device context (deviceId, userId, storeId)
   * @param limit - Max rows to return (1-500, default DEFAULT_PULL_LIMIT=500)
   * @returns Object with server_time, changes, pagination metadata
   * @throws BadRequestException if entity type is unknown
   */
  async pullEntity(
    entity: string,
    cursor: string | null | undefined,
    device: DeviceContext,
    limit: number = DEFAULT_PULL_LIMIT,
  ): Promise<{
    server_time: string;
    entity: string;
    changes: Array<{
      id: string;
      operation: 'upsert' | 'delete';
      data: Record<string, unknown> | null;
    }>;
    has_more: boolean;
    next_cursor: string;
  }> {
    // Step 1: Look up handler for entity type
    const handler = this.dispatcher.getHandler(entity);
    if (!handler) {
      throw new BadRequestException(
        `Unknown entity: ${entity}. Did you forget to register the handler in the module?`,
      );
    }

    // Step 2: Parse cursor
    // Cursor format: '<timestamp_ms>:<uuid>'
    // INITIAL_CURSOR = '0:00000000-0000-0000-0000-000000000000'
    const { ts, id } = this.cursorService.parse(cursor);
    this.logger.debug(
      `[Sync] Pulling ${entity} from cursor ${ts.getTime()}:${id} with limit ${limit}`,
    );

    // Step 3: Execute in REPEATABLE READ transaction
    // REPEATABLE READ isolation ensures server_time and data are transactionally consistent
    const result = await this.tx.run(
      async (tx: DbTransaction) => {
        // Capture server time at transaction start
        // This ensures all data fetched in this transaction is from the same snapshot
        const timeResult = await tx.execute<{ now: Date }>(
          sql`SELECT NOW() AS now`,
        );
        const serverTime = new Date(timeResult.rows[0].now);

        // Fetch changes using compound cursor pagination
        // Handler implements the entity-specific query with proper store filtering
        const changeset = await handler.getChangesSince(
          ts,
          id,
          device.storeId,
          limit,
          tx,
        );

        return {
          server_time: serverTime.toISOString(),
          entity,
          changes: changeset.changes,
          has_more: changeset.hasMore,
          next_cursor: changeset.nextCursor,
        };
      },
      {
        name: `Sync.pullEntity:${entity}`,
        isolationLevel: 'repeatable read',
      },
    );

    this.logger.log(
      `[Sync] Pulled ${entity}: ${result.changes.length} changes, has_more=${result.has_more} (store: ${device.storeId})`,
    );

    return result;
  }
}