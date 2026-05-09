import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema';
import { InternalServerException } from '../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../common/constants/error-codes.constants';

type Db = NodePgDatabase<typeof schema>;

/**
 * SyncBaseRepository extends BaseRepository with sync-aware write methods.
 *
 * For syncable tables (with version, createdByDevice, audit columns):
 *
 * **Web Write Contract:**
 *   - insertOneSync() — creates with version=1, createdByDevice=null
 *   - updateOneSync() — increments version, sets updated_at=NOW()
 *   - softDeleteSync() — soft deletes with version++, sets deletedAt
 *
 * **Sync Handler Contract:**
 *   - Handlers call these methods to persist writes from mobile devices
 *   - updateOneSync is called after version validation (FOR UPDATE lock)
 *   - softDeleteSync is called after version validation (FOR UPDATE lock)
 *
 * **Audit Trail:**
 *   - All operations set createdBy/modifiedBy = userId
 *   - All operations set createdAt/updatedAt = NOW()
 *   - All write operations increment version for optimistic concurrency
 *
 * **Multi-tenancy:**
 *   - WHERE clauses must include store_fk filter (caller's responsibility)
 *   - All deletes are soft (hard deletes forbidden at application layer)
 *
 * **Transactions:**
 *   - All methods accept optional tx parameter
 *   - If tx provided, queries run in that transaction
 *   - If tx omitted, queries run immediately on db connection
 */
export abstract class SyncBaseRepository {
  private readonly baseLogger = new Logger(SyncBaseRepository.name);

  constructor(protected readonly db: Db) {}

  protected static toOffset(page: number, pageSize: number): number {
    return (Math.max(page, 1) - 1) * Math.max(pageSize, 1);
  }

  /**
   * Repository-layer invariant guard.
   *
   * These checks (userId > 0, non-empty update set, etc.) are caller pre-conditions
   * the service/validator layer is supposed to enforce *before* reaching the data
   * layer. If one fires here it signals a bug in the calling code, not a user error,
   * so we raise InternalServerException — never a 4xx. Validation of user-supplied
   * input belongs to validators in the service layer.
   */
  private assertInvariant(condition: unknown, message: string): asserts condition {
    if (!condition) {
      this.baseLogger.error(`Repository invariant violated: ${message}`);
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }

  /**
   * Insert a row on a syncable table.
   *
   * Sets sync columns:
   *   - version = 1 (first version)
   *   - createdByDevice = null (indicates web origin; mobile uses device UUID)
   *
   * Sets audit columns:
   *   - createdBy = userId
   *   - createdAt = NOW()
   *   - modifiedBy = userId
   *   - updatedAt = NOW() (used for pull cursor ordering)
   *
   * @param table - The table to insert into
   * @param values - Values to insert (all columns except version, createdByDevice, and audit fields)
   * @param userId - User ID for audit trail
   * @param tx - Optional transaction context
   * @returns The inserted row with all audit and sync columns populated
   * @throws InternalServerException if insert returns no row
   */
  protected async insertOneSync<T extends PgTable>(
    table: T,
    values: Record<string, unknown>,
    userId: number,
    tx?: Db,
  ): Promise<T['$inferSelect']> {
    const db: Db = tx ?? this.db;

    this.assertInvariant(userId && userId > 0, `insertOneSync: userId must be > 0 (got ${userId})`);

    const now = new Date();

    try {
      const rows = await db
        .insert(table)
        .values({
          ...values,
          version: 1,
          createdByDevice: null, // Web origin
          createdBy: userId,
          createdAt: now,
          modifiedBy: userId,
          updatedAt: now,
        } as any)
        .returning();

      const row = rows[0];
      if (!row) {
        this.baseLogger.error(
          `insertOneSync returned no row for table ${(table as any).name}`,
          { userId },
        );
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
      }

      this.baseLogger.debug(
        `insertOneSync: ${(table as any).name} id=${(row as any).id} v=${(row as any).version}`,
      );

      return row;
    } catch (err) {
      if (err instanceof InternalServerException) {
        throw err;
      }
      this.baseLogger.error(
        `insertOneSync failed for table ${(table as any).name}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }

  /**
   * Update a row on a syncable table, incrementing version.
   *
   * Flow:
   *   1. Fetch current row to get current version
   *   2. If not found → return null (no match on WHERE clause)
   *   3. Increment version: new_version = current_version + 1
   *   4. Update row with new fields, new_version, updated_at
   *   5. Return updated row
   *
   * Sets:
   *   - version = current_version + 1 (optimistic concurrency)
   *   - updatedAt = NOW() (for pull cursor ordering)
   *   - modifiedBy = userId (audit trail)
   *   - [custom fields from set object]
   *
   * **Note:** The WHERE clause is the caller's responsibility.
   * Caller MUST ensure WHERE includes store_fk for multi-tenancy safety.
   *
   * @param table - The table to update
   * @param set - Fields to update (caller provides, not including version/updatedAt/modifiedBy)
   * @param where - WHERE clause (e.g., eq(table.id, id) AND eq(table.storeFk, storeId))
   * @param userId - User ID for audit trail
   * @param tx - Optional transaction context
   * @returns Updated row or null if no match on WHERE clause
   * @throws BadRequestException if set is empty or invalid
   * @throws InternalServerException if database error occurs
   */
  protected async updateOneSync<T extends PgTable>(
    table: T,
    set: Record<string, unknown>,
    where: SQL,
    userId: number,
    tx?: Db,
  ): Promise<T['$inferSelect'] | null> {
    this.assertInvariant(
      set && Object.keys(set).length > 0,
      'updateOneSync: set must be a non-empty object',
    );
    this.assertInvariant(userId && userId > 0, `updateOneSync: userId must be > 0 (got ${userId})`);

    const db = tx ?? this.db;
    const now = new Date();

    try {
      // Step 1: Fetch current row to get current version
      const current = await db
        .select()
        .from(table as any)
        .where(where)
        .limit(1);

      // Step 2: If not found, return null
      if (!current || current.length === 0) {
        this.baseLogger.debug(
          `updateOneSync: no row found for table ${(table as any).name}`,
        );
        return null;
      }

      const currentRow = current[0] as any;
      const currentVersion = currentRow.version ?? 0;
      const newVersion = currentVersion + 1;

      // Step 3-4: Update with incremented version
      const updated = await db
        .update(table as any)
        .set({
          ...set,
          version: newVersion,
          modifiedBy: userId,
          updatedAt: now,
        } as any)
        .where(where)
        .returning();

      // Step 5: Return updated row
      const updatedRow = (updated[0] ?? null) as T['$inferSelect'] | null;
      if (updatedRow) {
        this.baseLogger.debug(
          `updateOneSync: ${(table as any).name} id=${(updatedRow as any).id} v=${currentVersion}->${newVersion}`,
        );
      }
      return updatedRow;
    } catch (err) {
      if (err instanceof InternalServerException) {
        throw err;
      }
      this.baseLogger.error(
        `updateOneSync failed for table ${(table as any).name}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }

  /**
   * Soft delete a row on a syncable table, incrementing version.
   *
   * **Hard deletes are FORBIDDEN.** All deletes must be soft (set deletedAt).
   * Only the tombstone-GC scheduler (Phase 2) may hard-delete after 90 days.
   *
   * Flow:
   *   1. Fetch current row to get current version
   *   2. If not found → return null
   *   3. Increment version: new_version = current_version + 1
   *   4. Mark as deleted: deletedAt=NOW(), deletedBy=userId, isActive=false, version++
   *   5. Return updated row
   *
   * Sets:
   *   - deletedAt = NOW() (soft delete marker)
   *   - deletedBy = userId (audit trail)
   *   - isActive = false (denormalized flag for queries)
   *   - version = current_version + 1 (optimistic concurrency)
   *   - updatedAt = NOW() (for pull cursor ordering)
   *   - modifiedBy = userId (audit trail)
   *
   * **Note:** The WHERE clause is the caller's responsibility.
   * Caller MUST ensure WHERE includes store_fk for multi-tenancy safety.
   *
   * @param table - The table to soft-delete from
   * @param where - WHERE clause (e.g., eq(table.id, id) AND eq(table.storeFk, storeId))
   * @param userId - User ID for audit trail
   * @param tx - Optional transaction context
   * @returns Deleted row or null if no match on WHERE clause
   * @throws BadRequestException if userId is invalid
   * @throws InternalServerException if database error occurs
   */
  protected async softDeleteSync<T extends PgTable>(
    table: T,
    where: SQL,
    userId: number,
    tx?: Db,
  ): Promise<T['$inferSelect'] | null> {
    this.assertInvariant(userId && userId > 0, `softDeleteSync: userId must be > 0 (got ${userId})`);

    const db = tx ?? this.db;
    const now = new Date();

    try {
      // Step 1: Fetch current row to get current version
      const current = await db
        .select()
        .from(table as any)
        .where(where)
        .limit(1);

      // Step 2: If not found, return null
      if (!current || current.length === 0) {
        this.baseLogger.debug(
          `softDeleteSync: no row found for table ${(table as any).name}`,
        );
        return null;
      }

      const currentRow = current[0] as any;
      const currentVersion = currentRow.version ?? 0;
      const newVersion = currentVersion + 1;

      // Step 3-4: Soft delete with version++
      const deleted = await db
        .update(table as any)
        .set({
          deletedAt: now,
          deletedBy: userId,
          isActive: false,
          version: newVersion,
          modifiedBy: userId,
          updatedAt: now,
        } as any)
        .where(where)
        .returning();

      // Step 5: Return deleted row
      const deletedRow = (deleted[0] ?? null) as T['$inferSelect'] | null;
      if (deletedRow) {
        this.baseLogger.debug(
          `softDeleteSync: ${(table as any).name} id=${(deletedRow as any).id} v=${currentVersion}->${newVersion}`,
        );
      }
      return deletedRow;
    } catch (err) {
      if (err instanceof InternalServerException) {
        throw err;
      }
      this.baseLogger.error(
        `softDeleteSync failed for table ${(table as any).name}: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }

  /**
   * Pagination helper. Calculates total count based on page size.
   *
   * Usage:
   *   const data = db.select().from(table).where(...).limit(pageSize).offset(offset);
   *   const count = db.select({ total: count() }).from(table).where(...);
   *   const { rows, total } = await this.paginate(data, count, page, pageSize);
   *
   * @param dataPromise - Promise returning the page of rows
   * @param countFactory - Factory function returning count result
   * @param page - Current page (1-indexed)
   * @param pageSize - Rows per page
   * @returns Object with rows and total count
   * @throws InternalServerException if count query fails
   */
  protected async paginate<T>(
    dataPromise: Promise<T[]>,
    countFactory: () => Promise<{ total: number }[]>,
    page: number,
    pageSize: number,
  ): Promise<{ rows: T[]; total: number }> {
    const rows = await dataPromise;
    const offset = SyncBaseRepository.toOffset(page, pageSize);

    // If we got fewer rows than pageSize, we've reached the end
    if (rows.length < pageSize) {
      return { rows, total: offset + rows.length };
    }

    // Otherwise, fetch the total count
    try {
      const countRows = await countFactory();
      const total = countRows[0]?.total;
      if (total === undefined) {
        throw new InternalServerException(
          errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
        );
      }
      return { rows, total };
    } catch (err) {
      this.baseLogger.error(
        `paginate count failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
  }
}