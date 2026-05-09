import type { DeviceContext } from '../types/device-context';
import type { SyncResult } from '../types/sync-result';
import type { SyncOperation } from '../types/sync-operation';

/**
 * SyncHandler defines the contract for handling sync operations on a specific entity.
 *
 * Domain teams extend BaseSyncHandler (which implements this interface) and
 * override the abstract methods to define entity-specific logic.
 *
 * Example:
 *
 *   @Injectable()
 *   export class ProductsSyncService extends BaseSyncHandler {
 *     readonly entity = 'product';
 *
 *     async applyCreate(op, device, tx) {
 *       // Create product logic
 *     }
 *
 *     toWireFormat(row) {
 *       return { id: row.id, name: row.name, ... };
 *     }
 *   }
 */
export interface SyncHandler {
  /**
   * Entity type identifier (lowercase, singular).
   * Must match what mobile sends in SyncOperation.entity.
   * Examples: 'product', 'customer', 'sale'.
   */
  readonly entity: string;

  /**
   * Apply a single operation (create/update/delete) atomically.
   *
   * Called inside a database transaction. Handler must:
   * - Validate input
   * - Check business rules
   * - Lock for update on update/delete
   * - Check version on update/delete
   * - Return the appropriate SyncResult
   *
   * @param op - The operation to apply
   * @param device - The device making the request (for multi-tenancy, audit)
   * @param tx - Database transaction context (use this for all DB operations)
   * @returns SyncResult indicating success or failure
   */
  apply(
    op: SyncOperation,
    device: DeviceContext,
    tx: any, // EntityManager or transaction object
  ): Promise<SyncResult>;

  /**
   * Fetch changes since a cursor for pull operations.
   *
   * Called inside a REPEATABLE READ transaction. Returns paginated results
   * with a cursor for the next page.
   *
   * Must query:
   *   WHERE store_fk = storeId
   *     AND (updated_at > cursorTs OR (updated_at = cursorTs AND id > cursorId))
   *   ORDER BY updated_at ASC, id ASC
   *   LIMIT limit + 1
   *
   * Fetch limit+1 to detect if there are more pages.
   *
   * @param cursorTs - Timestamp of last row from previous page
   * @param cursorId - UUID of last row from previous page
   * @param storeId - Store ID (for multi-tenancy)
   * @param limit - Max rows to return (before +1)
   * @param tx - Database transaction context
   * @returns { changes, hasMore, nextCursor }
   */
  getChangesSince(
    cursorTs: Date,
    cursorId: string,
    storeId: number,
    limit: number,
    tx: any,
  ): Promise<{
    changes: Array<{
      id: string;
      operation: 'upsert' | 'delete';
      data: Record<string, unknown> | null; // null for deletes
    }>;
    hasMore: boolean;
    nextCursor: string;
  }>;
}
