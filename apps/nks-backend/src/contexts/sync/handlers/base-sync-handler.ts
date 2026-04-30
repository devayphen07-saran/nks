import { Logger } from '@nestjs/common';
import type { ZodType } from 'zod';
import type { DbTransaction } from '../../../core/database/transaction.service';
import type { SyncOperation } from '../dto';
import type {
  SyncHandler,
  SyncHandlerResult,
  SyncPullBatch,
} from './sync-handler.interface';

/**
 * Minimum shape every syncable row must satisfy: a numeric primary key and
 * a monotonically-increasing `version` column. Both are required for
 * optimistic concurrency control.
 */
export interface SyncableRow {
  id: number;
  version: number;
}

/**
 * BaseSyncHandler — canonical implementation of a domain sync handler.
 *
 * The base class enforces every invariant the raw `SyncHandler` interface
 * describes only as a contract:
 *
 *   1. Schema validation BEFORE any DB call (`INVALID_SHAPE` rejection).
 *   2. Row read with FOR UPDATE lock BEFORE version comparison
 *      (so `serverState` returned on conflict is the truth at that instant,
 *      not a phantom that another transaction can mutate before we reply).
 *   3. Version comparison BEFORE any `applyXxx` write — concrete handlers
 *      receive the verified `newVersion` as a parameter and cannot forget
 *      to bump it (the value is already incremented when handed in).
 *   4. Soft delete only — `applySoftDelete` bumps the version and sets
 *      `deleted_at`/`deleted_by`. Hard delete is not supported because it
 *      breaks version-based reconciliation across replicas.
 *   5. `serverState` on `ok` is the row AFTER the write — the client
 *      replaces its local copy verbatim.
 *
 * Concrete subclasses implement five small methods:
 *   - `createSchema`, `updateSchema`, `deleteSchema` — Zod schemas. The
 *     update/delete schemas MUST include `id: number` and `version: number`.
 *   - `findByIdForUpdate(id, tx)` — read with `SELECT … FOR UPDATE`.
 *   - `applyCreate(data, userId, tx)` — insert; return the created row.
 *   - `applyUpdate(id, data, newVersion, userId, tx)` — update by id; the
 *     `version=current.version` predicate is already satisfied by the lock.
 *   - `applySoftDelete(id, newVersion, userId, tx)` — soft-delete with
 *     version bump and deletedAt/deletedBy.
 *
 * All five MUST run inside the provided `tx`. No external side effects.
 */
export abstract class BaseSyncHandler<TRow extends SyncableRow>
  implements SyncHandler<TRow>
{
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Sync table name (matches `op.table` from clients and the pull-sync
   * `tables` query param). Subclasses MUST override.
   */
  abstract readonly table: string;

  /**
   * Pull-sync read. Subclasses fetch rows changed after the compound
   * cursor, map each to a `SyncChange`, and return the batch with
   * `nextCursor` + `hasMore`. Should fetch `limit + 1` internally so
   * `hasMore` is computed without a separate COUNT.
   */
  abstract getChanges(
    cursorMs: number,
    cursorId: number,
    limit: number,
  ): Promise<SyncPullBatch>;

  /** Schema for the `create` payload. Required fields are domain-specific. */
  protected abstract readonly createSchema: ZodType<unknown>;

  /**
   * Schema for the `update` payload. MUST validate that `id: number` and
   * `version: number` are present — the base class relies on those for
   * optimistic concurrency. Field-level updates beyond id/version are the
   * handler's choice.
   */
  protected abstract readonly updateSchema: ZodType<{ id: number; version: number }>;

  /**
   * Schema for the `delete` payload. MUST validate `id: number` and
   * `version: number`. Most handlers reuse the update schema's id/version
   * pair via `z.object({ id: …, version: … })`.
   */
  protected abstract readonly deleteSchema: ZodType<{ id: number; version: number }>;

  /**
   * Read the row by id WITH a row-level lock (`SELECT … FOR UPDATE`).
   * Returns null if the row does not exist (or has been hard-deleted, but
   * see class docs — hard delete is unsupported for syncable tables).
   */
  protected abstract findByIdForUpdate(
    id: number,
    tx: DbTransaction,
  ): Promise<TRow | null>;

  /**
   * Insert a new row. The base class has already validated the shape via
   * `createSchema` and assigned `version = 1` is the handler's job.
   */
  protected abstract applyCreate(
    data: unknown,
    userId: number,
    tx: DbTransaction,
  ): Promise<TRow>;

  /**
   * Update an existing row. The base class has already verified
   * `current.version === incomingData.version` and computed `newVersion`.
   * The handler MUST persist `version = newVersion` along with field
   * updates from `data`.
   */
  protected abstract applyUpdate(
    id: number,
    data: unknown,
    newVersion: number,
    userId: number,
    tx: DbTransaction,
  ): Promise<TRow>;

  /**
   * Soft-delete the row: set `deleted_at`, `deleted_by`, `is_active=false`,
   * and persist `version = newVersion`. The returned `TRow` is the deleted
   * record (so the client can confirm and update its tombstone).
   */
  protected abstract applySoftDelete(
    id: number,
    newVersion: number,
    userId: number,
    tx: DbTransaction,
  ): Promise<TRow>;

  /**
   * Public entry point — implements `SyncHandler.handle`. Concrete
   * subclasses do NOT override this.
   */
  async handle(
    op: SyncOperation,
    userId: number,
    _activeStoreId: number | null,
    tx: DbTransaction,
  ): Promise<SyncHandlerResult<TRow>> {
    if (op.op === 'create') {
      const parsed = this.createSchema.safeParse(op.opData);
      if (!parsed.success) {
        return { status: 'rejected', reason: 'INVALID_SHAPE' };
      }
      const created = await this.applyCreate(parsed.data, userId, tx);
      return { status: 'ok', serverState: created };
    }

    if (op.op === 'update') {
      const parsed = this.updateSchema.safeParse(op.opData);
      if (!parsed.success) {
        return {
          status: 'rejected',
          reason: this.missingVersion(parsed.error)
            ? 'VERSION_REQUIRED'
            : 'INVALID_SHAPE',
        };
      }
      const data = parsed.data;
      const current = await this.findByIdForUpdate(data.id, tx);
      if (!current) return { status: 'rejected', reason: 'NOT_FOUND' };
      if (current.version !== data.version) {
        return { status: 'conflict', serverState: current };
      }
      const newVersion = current.version + 1;
      const updated = await this.applyUpdate(
        data.id,
        parsed.data,
        newVersion,
        userId,
        tx,
      );
      return { status: 'ok', serverState: updated };
    }

    if (op.op === 'delete') {
      const parsed = this.deleteSchema.safeParse(op.opData);
      if (!parsed.success) {
        return {
          status: 'rejected',
          reason: this.missingVersion(parsed.error)
            ? 'VERSION_REQUIRED'
            : 'INVALID_SHAPE',
        };
      }
      const data = parsed.data;
      const current = await this.findByIdForUpdate(data.id, tx);
      if (!current) return { status: 'rejected', reason: 'NOT_FOUND' };
      if (current.version !== data.version) {
        return { status: 'conflict', serverState: current };
      }
      const newVersion = current.version + 1;
      const deleted = await this.applySoftDelete(
        data.id,
        newVersion,
        userId,
        tx,
      );
      return { status: 'ok', serverState: deleted };
    }

    return { status: 'rejected', reason: 'INVALID_OP' };
  }

  /**
   * Distinguish "version field missing" from generic shape errors so the
   * client can prompt for a fresh pull rather than a generic "bad payload"
   * message.
   */
  private missingVersion(err: { issues: Array<{ path: PropertyKey[] }> }): boolean {
    return err.issues.some((i) => i.path[0] === 'version');
  }
}
