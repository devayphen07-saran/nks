import { Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { InjectDb } from './inject-db.decorator';
import * as schema from './schema';
import type { DbTransaction } from './transaction.service';
import { InternalServerException } from '../../common/exceptions';
import {
  ErrorCode,
  errPayload,
} from '../../common/constants/error-codes.constants';

type Db = NodePgDatabase<typeof schema>;

type CreateAuditKeys = 'createdBy' | 'createdAt';
type UpdateAuditKeys = 'modifiedBy' | 'updatedAt';

/*
 * ── Conventions ──────────────────────────────────────────────────────────
 *
 * Audit columns:  These helpers require tables built with `auditFields()`
 *   from `schema/base.entity.ts`. Tables from `betterAuthEntity` /
 *   `junctionEntity` / `appendOnlyEntity` lack audit columns and must use
 *   raw `db.insert(...)` / `db.update(...)`. Drizzle's generic `PgTable`
 *   cannot enforce this at the type level — enforce via code review.
 *
 * Sync columns: For syncable tables (with version, createdByDevice):
 *   Use insertOneSync() and updateOneSync() instead of the audit variants.
 *   Sync methods automatically manage version incrementing and created_by_device.
 *
 * Error strategy:
 *   • insertOneAudited/Sync → always throws on failure (caller expects a row)
 *   • updateOneAudited/Sync → returns null when WHERE matches nothing
 *   • softDeleteAudited      → returns null when WHERE matches nothing
 *   Services map null to 404 or treat as no-op. This is intentional — a
 *   zero-match update is a valid outcome, a zero-row insert is not.
 *
 * Transactions:  All write helpers accept an optional `tx`. Services that
 *   group multiple writes MUST pass a transaction. This is not enforced
 *   here — enforce at the service layer.
 *
 * Pagination:  Callers MUST apply an explicit ORDER BY to the data query.
 *   Without stable ordering, paginated results are non-deterministic.
 *
 * Bulk operations:  These helpers handle single rows. For multi-row
 *   inserts/updates, use `db.insert(table).values([...])` directly.
 *
 * Page/pageSize bounds:  Clamp at DTO validation, not here.
 * ─────────────────────────────────────────────────────────────────────────
 */

export abstract class BaseRepository {
  // Kept for the one critical failure case (insert returning no row).
  // All other logging belongs in the service layer.
  private readonly baseLogger = new Logger(BaseRepository.name);

  constructor(@InjectDb() protected readonly db: Db) {}

  protected static toOffset(page: number, pageSize: number): number {
    return (Math.max(page, 1) - 1) * Math.max(pageSize, 1);
  }

  protected async insertOneAudited<T extends PgTable>(
    table: T,
    values: Omit<T['$inferInsert'], CreateAuditKeys>,
    userId: number | null,
    tx?: DbTransaction,
  ): Promise<T['$inferSelect']> {
    const rows = (await (tx ?? this.db)
      .insert(table)
      .values({
        ...values,
        createdBy: userId,
        createdAt: new Date(),
      } as T['$inferInsert'])
      .returning()) as T['$inferSelect'][];

    const row = rows[0];
    if (!row) {
      this.baseLogger.error('insertOneAudited returned no row', { userId });
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
    return row;
  }

  protected async updateOneAudited<T extends PgTable>(
    table: T,
    set: Partial<Omit<T['$inferInsert'], CreateAuditKeys | UpdateAuditKeys>>,
    where: SQL,
    userId: number,
    tx?: DbTransaction,
  ): Promise<T['$inferSelect'] | null> {
    // Repository-layer invariant: callers must never request an empty update.
    // An empty `set` would update only audit columns, which is almost certainly
    // a bug at the call site (forgot to populate the patch). This is a
    // programmer error, not user input — surface as InternalServerException
    // rather than a user-facing 4xx.
    if (!set || Object.keys(set).length === 0) {
      this.baseLogger.error(
        `updateOneAudited invariant violated: empty set passed for table ${(table as any).name ?? 'unknown'}`,
      );
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }

    const rows = (await (tx ?? this.db)
      .update(table)
      .set({
        ...set,
        modifiedBy: userId,
        updatedAt: new Date(),
      } as Partial<T['$inferInsert']>)
      .where(where)
      .returning()) as T['$inferSelect'][];

    return rows[0] ?? null;
  }

  protected async softDeleteAudited<T extends PgTable>(
    table: T,
    where: SQL,
    userId: number,
    tx?: DbTransaction,
  ): Promise<T['$inferSelect'] | null> {
    const rows = (await (tx ?? this.db)
      .update(table)
      .set({
        deletedBy: userId,
        deletedAt: new Date(),
        isActive: false,
      } as Partial<T['$inferInsert']>)
      .where(where)
      .returning()) as T['$inferSelect'][];

    return rows[0] ?? null;
  }

  /**
   * Run the data query, then an explicit count(*) when needed, and return
   * both together.
   *
   * Total computation:
   *   - If `page === 1` AND `rows.length < pageSize`, the entire result set
   *     fits in this page, so `total = rows.length` exactly. No count query.
   *   - Otherwise, run the count factory and use its result.
   *
   * Why not infer `total = (page-1)*pageSize + rows.length` on a partial
   * later page? Because that inference is only valid if no other connection
   * inserted/deleted between the page-1 fetch and the page-2 fetch — i.e.
   * never, under realistic concurrent load. The previous implementation
   * made that assumption and reported wrong totals whenever rows were
   * inserted or removed mid-pagination.
   *
   * Contract:
   *   - Callers MUST apply a stable ORDER BY in `dataPromise` (see file
   *     header). Without it, paginated results are non-deterministic.
   *   - `page` is 1-indexed; `pageSize` is clamped at the DTO layer.
   *   - The count factory should select count(*) over the same WHERE clause
   *     as the data query, with no LIMIT / OFFSET / ORDER BY.
   */
  protected async paginate<T>(
    dataPromise: Promise<T[]>,
    countFactory: () => Promise<{ total: number }[]>,
    page: number,
    pageSize: number,
  ): Promise<{ rows: T[]; total: number }> {
    const rows = await dataPromise;

    // Fast path: page 1 returned fewer rows than the page size, so the full
    // result set fits in this page. Total is known exactly without a count.
    if (page === 1 && rows.length < pageSize) {
      return { rows, total: rows.length };
    }

    const countRows = await countFactory();
    const total = countRows[0]?.total;
    if (total === undefined) {
      throw new InternalServerException(
        errPayload(ErrorCode.INTERNAL_SERVER_ERROR),
      );
    }
    return { rows, total };
  }
}