import { BadRequestException } from '@nestjs/common';
import type { DeviceContext } from '../types/device-context';
import type { SyncResult } from '../types/sync-result';
import type { SyncOperation } from '../types/sync-operation';
import type { SyncHandler } from './sync-handler.interface';

/**
 * SyncableEntity interface — minimum shape for any entity that can be synced.
 *
 * All domain entities (Product, Customer, Sale, etc.) must have these properties.
 * They're provided by the syncColumns() helper in Phase 1:
 *   - version: incremented on every write, used for optimistic concurrency
 *   - updatedAt: set to NOW() on every write, used for cursor pagination
 *   - deletedAt: set on soft delete, null for active rows
 *   - id: primary key, can be string or number depending on schema
 */
interface SyncableEntity {
  id: string | number;
  version: number;
  updatedAt: Date | null;
  deletedAt?: Date | null;
}

/**
 * BaseSyncHandler is the abstract base class for all domain-specific sync handlers.
 *
 * It provides:
 * - Operation dispatch (create/update/delete)
 * - FOR UPDATE locking on update/delete (pessimistic locking)
 * - Version checking (optimistic concurrency control)
 * - Soft deletes only (hard deletes forbidden at application layer)
 * - Compound cursor pagination for pulls (handles multiple rows with same updated_at)
 *
 * Domain handlers extend this and override:
 * - toWireFormat() — convert DB row to API response shape
 * - applyCreate() — entity-specific create logic (validation, defaults, etc.)
 * - findByIdForUpdate() — fetch row with FOR UPDATE lock
 * - queryChangesSince() — compound cursor query for pagination
 * - saveEntity() — persist entity (via repo or tx.save())
 *
 * Optionally override:
 * - applyUpdate() — custom update logic (default: Object.assign)
 * - handleUpdate() / handleDelete() — custom operation handlers
 *
 * Generic type T represents the DB entity type (Product, Customer, Sale, etc.).
 * Must extend SyncableEntity to ensure version, updatedAt, deletedAt exist.
 */
export abstract class BaseSyncHandler<T extends SyncableEntity> implements SyncHandler {
  /**
   * Entity type string (e.g., 'product', 'customer', 'sale').
   * Subclasses must set this.
   */
  abstract readonly entity: string;

  /**
   * Apply a sync operation (create/update/delete).
   *
   * Dispatches to appropriate handler based on operation type.
   * Each handler manages its own transaction and error recovery.
   *
   * @param op - Sync operation (client_op_id, operation, client_id, payload)
   * @param device - Device context (deviceId, userId, storeId)
   * @param tx - Transaction context (EntityManager or similar)
   * @returns SyncResult discriminated union (ok | duplicate | conflict | rejected | error)
   */
  async apply(
    op: SyncOperation,
    device: DeviceContext,
    tx: any,
  ): Promise<SyncResult> {
    switch (op.operation) {
      case 'create':
        return this.handleCreate(op, device, tx);
      case 'update':
        return this.handleUpdate(op, device, tx);
      case 'delete':
        return this.handleDelete(op, device, tx);
      default:
        return {
          status: 'rejected',
          client_op_id: op.client_op_id,
          reason: `Invalid operation: ${op.operation}`,
        };
    }
  }

  /**
   * Handle a create operation.
   *
   * Dispatches to applyCreate() which is implemented by the subclass.
   * Subclass is responsible for:
   *   - Checking for UUID collision (duplicate)
   *   - Creating entity with version=1, created_by_device, etc.
   *   - Returning appropriate SyncResult
   *
   * @param op - Sync operation
   * @param device - Device context
   * @param tx - Transaction context
   * @returns SyncResult
   */
  private async handleCreate(
    op: SyncOperation,
    device: DeviceContext,
    tx: any,
  ): Promise<SyncResult> {
    try {
      return await this.applyCreate(op, device, tx);
    } catch (err) {
      return {
        status: 'error',
        client_op_id: op.client_op_id,
        reason: err instanceof Error ? err.message : 'Unknown error during create',
      };
    }
  }

  /**
   * Handle an update operation.
   *
   * Flow:
   *   1. Lock row with FOR UPDATE
   *   2. Check row exists → rejected if not
   *   3. Check version matches expected_version → conflict if not (return server_state)
   *   4. Call applyUpdate() for domain-specific logic
   *   5. Increment version, set updated_at = NOW()
   *   6. Save entity
   *   7. Return ok with new version
   *
   * Subclasses may override to customize behavior, but should preserve locking pattern.
   *
   * @param op - Sync operation (payload should contain expected_version)
   * @param device - Device context
   * @param tx - Transaction context
   * @returns SyncResult
   */
  protected async handleUpdate(
    op: SyncOperation,
    device: DeviceContext,
    tx: any,
  ): Promise<SyncResult> {
    try {
      // 1. Acquire FOR UPDATE lock
      const entity = await this.findByIdForUpdate(
        op.client_id,
        device.storeId,
        tx,
      );

      if (!entity) {
        return {
          status: 'rejected',
          client_op_id: op.client_op_id,
          reason: 'Entity not found',
        };
      }

      // 2. Check version (optimistic concurrency)
      const payload = op.payload as any;
      const expectedVersion = payload.expected_version;

      if (entity.version !== expectedVersion) {
        return {
          status: 'conflict',
          client_op_id: op.client_op_id,
          reason: `Version mismatch: expected ${expectedVersion}, got ${entity.version}`,
          server_state: this.toWireFormat(entity),
        };
      }

      // 3. Apply domain-specific update logic
      const updatedEntity = await this.applyUpdate(op, device, entity, tx);

      // 4. Increment version, set updated_at
      updatedEntity.version = entity.version + 1;
      updatedEntity.updatedAt = new Date();

      // 5. Save entity
      await this.saveEntity(updatedEntity, tx);

      return {
        status: 'ok',
        client_op_id: op.client_op_id,
        server_id: String(updatedEntity.id),
        version: updatedEntity.version,
      };
    } catch (err) {
      return {
        status: 'error',
        client_op_id: op.client_op_id,
        reason: err instanceof Error ? err.message : 'Unknown error during update',
      };
    }
  }

  /**
   * Handle a delete operation (soft delete).
   *
   * Flow:
   *   1. Lock row with FOR UPDATE
   *   2. Check row exists → rejected if not
   *   3. Check version matches expected_version → conflict if not
   *   4. Set deleted_at = NOW()
   *   5. Increment version, set updated_at = NOW()
   *   6. Save entity
   *   7. Return ok
   *
   * Hard deletes are FORBIDDEN at application layer.
   * Only the tombstone-GC scheduler (Phase 2) may hard-delete after 90 days.
   *
   * Subclasses may override for custom behavior (e.g., cascade deletes).
   *
   * @param op - Sync operation (payload should contain expected_version)
   * @param device - Device context
   * @param tx - Transaction context
   * @returns SyncResult
   */
  protected async handleDelete(
    op: SyncOperation,
    device: DeviceContext,
    tx: any,
  ): Promise<SyncResult> {
    try {
      // 1. Acquire FOR UPDATE lock
      const entity = await this.findByIdForUpdate(
        op.client_id,
        device.storeId,
        tx,
      );

      if (!entity) {
        return {
          status: 'rejected',
          client_op_id: op.client_op_id,
          reason: 'Entity not found',
        };
      }

      // 2. Check version (optimistic concurrency)
      const payload = op.payload as any;
      const expectedVersion = payload.expected_version;

      if (entity.version !== expectedVersion) {
        return {
          status: 'conflict',
          client_op_id: op.client_op_id,
          reason: `Version mismatch: expected ${expectedVersion}, got ${entity.version}`,
          server_state: this.toWireFormat(entity),
        };
      }

      // 3. Soft delete: set deleted_at, increment version, set updated_at
      entity.deletedAt = new Date();
      entity.version = entity.version + 1;
      entity.updatedAt = new Date();

      // 4. Save entity
      await this.saveEntity(entity, tx);

      return {
        status: 'ok',
        client_op_id: op.client_op_id,
        server_id: String(entity.id),
        version: entity.version,
      };
    } catch (err) {
      return {
        status: 'error',
        client_op_id: op.client_op_id,
        reason: err instanceof Error ? err.message : 'Unknown error during delete',
      };
    }
  }

  /**
   * Fetch changes since a cursor for pull operations (pagination).
   *
   * Implements compound cursor logic to handle multiple rows with same updated_at:
   *   WHERE store_fk = storeId
   *     AND (updated_at > cursorTs OR (updated_at = cursorTs AND id > cursorId))
   *   ORDER BY updated_at ASC, id ASC
   *
   * Fetches limit+1 rows to detect has_more.
   * Returns changes with operation type (upsert | delete).
   *
   * @param cursorTs - Cursor timestamp (from last row's updated_at)
   * @param cursorId - Cursor id (from last row's id)
   * @param storeId - Store ID (for multi-tenancy)
   * @param limit - Max rows to return
   * @param tx - Transaction context
   * @returns Object with changes array, hasMore flag, and next cursor string
   */
  async getChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    tx: any,
  ): Promise<{
    changes: Array<{
      id: string;
      operation: 'upsert' | 'delete';
      data: Record<string, unknown> | null;
    }>;
    hasMore: boolean;
    nextCursor: string;
  }> {
    try {
      // Query limit+1 to detect has_more
      const rows = await this.queryChangesSince(
        cursorTs,
        cursorId,
        storeId,
        limit + 1,
        tx,
      );

      // Check if we have more rows than requested
      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      if (page.length === 0) {
        // No rows; return cursor as-is
        return {
          changes: [],
          hasMore: false,
          nextCursor: `${cursorTs.getTime()}:${cursorId}`,
        };
      }

      const lastRow = page[page.length - 1];
      const lastUpdatedAt = lastRow.updatedAt ?? new Date();
      const nextCursor = `${lastUpdatedAt.getTime()}:${lastRow.id}`;

      // Map rows to changes: deleted = operation:'delete', else = operation:'upsert'
      const changes = page.map((row) => ({
        id: String(row.id),
        operation: row.deletedAt ? ('delete' as const) : ('upsert' as const),
        data: row.deletedAt ? null : this.toWireFormat(row),
      }));

      return { changes, hasMore, nextCursor };
    } catch (err) {
      throw new BadRequestException(
        `Failed to query changes since cursor for ${this.entity}: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      );
    }
  }

  // ============================================================================
  // Abstract methods — Subclasses MUST implement these
  // ============================================================================

  /**
   * Convert a database row to the wire format (API response).
   *
   * Called when returning data to mobile or in conflict responses.
   * Subclass should omit internal fields, format numbers, etc.
   *
   * Example:
   *   toWireFormat(row: Product) {
   *     return {
   *       id: row.id,
   *       name: row.name,
   *       price: row.price.toString(),
   *       version: row.version,
   *       created_by_device: row.createdByDevice,
   *     };
   *   }
   *
   * @param entity - Database entity
   * @returns Object suitable for API response
   */
  abstract toWireFormat(entity: T): Record<string, unknown>;

  /**
   * Apply a create operation (domain-specific logic).
   *
   * Called by handleCreate(). Subclass is responsible for:
   *   - Validating payload
   *   - Checking for UUID collision (duplicate)
   *   - Creating entity with version=1, created_by_device, store_fk, etc.
   *   - Calling tx.save() or repo.create()
   *   - Returning appropriate SyncResult
   *
   * On success: return { status: 'ok', server_id: entity.id, version: 1 }
   * On duplicate: return { status: 'duplicate', server_id: existing.id, version: existing.version }
   * On validation error: return { status: 'rejected', reason: '...' }
   *
   * Example:
   *   async applyCreate(op, device, tx) {
   *     const existing = await tx.findOne(Product, { where: { id: op.client_id } });
   *     if (existing) {
   *       return {
   *         status: 'duplicate',
   *         client_op_id: op.client_op_id,
   *         server_id: existing.id,
   *         version: existing.version,
   *       };
   *     }
   *
   *     const product = tx.create(Product, {
   *       id: op.client_id,
   *       ...op.payload,
   *       version: 1,
   *       storeFk: device.storeId,
   *       createdByDevice: device.deviceId,
   *       updatedAt: new Date(),
   *     });
   *     await tx.save(product);
   *     return {
   *       status: 'ok',
   *       client_op_id: op.client_op_id,
   *       server_id: product.id,
   *       version: 1,
   *     };
   *   }
   *
   * @param op - Sync operation
   * @param device - Device context
   * @param tx - Transaction context
   * @returns SyncResult
   */
  abstract applyCreate(
    op: SyncOperation,
    device: DeviceContext,
    tx: any,
  ): Promise<SyncResult>;

  /**
   * Find a row by id with FOR UPDATE lock (for update/delete operations).
   *
   * Must be called within a transaction for the lock to be effective.
   * Implements pessimistic locking to prevent concurrent modifications.
   *
   * Query pattern:
   *   SELECT * FROM <table>
   *   WHERE id = <id> AND store_fk = <storeId>
   *   FOR UPDATE
   *
   * This blocks other transactions from modifying the row until this transaction commits.
   *
   * Example:
   *   async findByIdForUpdate(id, storeId, tx) {
   *     return tx
   *       .createQueryBuilder(Product, 'p')
   *       .where('p.id = :id', { id })
   *       .andWhere('p.storeFk = :storeId', { storeId })
   *       .setLock('pessimistic_write')
   *       .getOne();
   *   }
   *
   * @param id - Entity UUID (op.client_id)
   * @param storeId - Store ID (for multi-tenancy)
   * @param tx - Transaction context
   * @returns Entity or null if not found
   */
  protected async findByIdForUpdate(
    _id: string,
    _storeId: number,
    _tx: any,
  ): Promise<T | null> {
    throw new BadRequestException(`findByIdForUpdate not implemented for ${this.entity}`);
  }

  /**
   * Query rows that have changed since a cursor (for pull pagination).
   *
   * Implements compound cursor logic to handle rows with same updated_at.
   *
   * Query pattern:
   *   SELECT * FROM <table>
   *   WHERE store_fk = <storeId>
   *     AND (updated_at > <cursorTs> OR (updated_at = <cursorTs> AND id > <cursorId>))
   *   ORDER BY updated_at ASC, id ASC
   *   LIMIT <limit>
   *
   * This ensures no rows are skipped when multiple rows have the same updated_at.
   *
   * Example:
   *   async queryChangesSince(cursorTs, cursorId, storeId, limit, tx) {
   *     return tx
   *       .createQueryBuilder(Product, 'p')
   *       .where('p.storeFk = :storeId', { storeId })
   *       .andWhere(
   *         '(p.updatedAt > :cursorTs OR (p.updatedAt = :cursorTs AND p.id > :cursorId))',
   *         { cursorTs, cursorId }
   *       )
   *       .orderBy('p.updatedAt', 'ASC')
   *       .addOrderBy('p.id', 'ASC')
   *       .limit(limit)
   *       .getMany();
   *   }
   *
   * @param cursorTs - Cursor timestamp (last row's updated_at)
   * @param cursorId - Cursor id (last row's id)
   * @param storeId - Store ID (for multi-tenancy)
   * @param limit - Max rows to return (includes limit+1 for has_more detection)
   * @param tx - Transaction context
   * @returns Array of entities
   */
  protected abstract queryChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    tx: any,
  ): Promise<T[]>;

  /**
   * Save an entity (create or update).
   *
   * Called after modifications to persist changes.
   * Subclass should use their repository or tx.save().
   *
   * Example:
   *   async saveEntity(entity, tx) {
   *     await tx.save(entity);
   *   }
   *
   * @param entity - Entity to save
   * @param tx - Transaction context
   */
  protected async saveEntity(_entity: T, _tx: any): Promise<void> {
    throw new BadRequestException(`saveEntity not implemented for ${this.entity}`);
  }

  // ============================================================================
  // Optional overrides — Subclasses MAY override these
  // ============================================================================

  /**
   * Apply domain-specific update logic.
   *
   * Called after version check and FOR UPDATE lock, before incrementing version.
   * Default implementation copies payload fields to entity.
   *
   * Override if you have custom business rules:
   *   - Validation
   *   - Computed fields
   *   - Field transformations
   *   - Cascading updates
   *
   * Example:
   *   async applyUpdate(op, device, entity, tx) {
   *     // Custom validation
   *     if (op.payload.price < 0) {
   *       throw new Error('Price must be non-negative');
   *     }
   *
   *     // Apply changes
   *     Object.assign(entity, op.payload);
   *
   *     // Recompute totals
   *     if (op.payload.quantity !== undefined) {
   *       entity.totalCost = entity.quantity * entity.unitPrice;
   *     }
   *
   *     return entity;
   *   }
   *
   * @param op - Sync operation (contains payload to apply)
   * @param device - Device context
   * @param entity - Current entity (already locked with FOR UPDATE)
   * @param tx - Transaction context
   * @returns Updated entity
   */
  protected async applyUpdate(
    op: SyncOperation,
    device: DeviceContext,
    entity: T,
    tx: any,
  ): Promise<T> {
    // Default: copy all payload fields to entity
    Object.assign(entity, op.payload);
    return entity;
  }
}