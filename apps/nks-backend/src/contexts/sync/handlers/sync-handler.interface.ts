import type { DbTransaction } from '../../../core/database/transaction.service';
import type { SyncOperation, SyncChange } from '../dto';

/**
 * Standard rejection reasons surfaced to mobile clients.
 *
 * Keep this set narrow and semantic — clients branch on it. New entries are
 * an API contract change; coordinate with mobile before adding.
 */
export type SyncRejectReason =
  | 'INVALID_SHAPE'           // opData failed handler's Zod schema
  | 'VERSION_REQUIRED'        // update/delete arrived without `version`
  | 'NOT_FOUND'               // target row does not exist (or was hard-deleted)
  | 'FORBIDDEN'               // caller lacks permission for this row
  | 'BUSINESS_RULE_VIOLATION' // domain rule rejected the write
  | 'INVALID_OP'              // op.op was not in {create,update,delete}
  | 'IDEMPOTENCY_REPLAY';     // same idempotency key resubmitted with a different payload hash

/**
 * Outcome of a single sync push operation. The factory forwards this to
 * SyncService, which maps it onto the public `PushOpResult`.
 *
 *  - `ok`        — write applied. `serverState` is the row as it now exists
 *                  on the server (post-write); the client overwrites its
 *                  local copy with this. REQUIRED, not optional.
 *  - `conflict`  — version mismatch. `serverState` is the current committed
 *                  row (read with FOR UPDATE so it's the truth at that
 *                  instant). Handler MUST NOT have written anything; the
 *                  base class enforces this by performing the check before
 *                  any apply call.
 *  - `rejected`  — operation invalid (shape, permission, business rule).
 *                  `reason` is one of the well-known codes.
 *
 * Generic `TRow` lets each handler return its concrete row type so the
 * client side keeps strong types end-to-end.
 */
export type SyncHandlerResult<TRow extends object = Record<string, unknown>> =
  | { status: 'ok'; serverState: TRow }
  | { status: 'conflict'; serverState: TRow }
  | { status: 'rejected'; reason: SyncRejectReason };

/**
 * Interface every domain sync handler implements. **Prefer extending
 * `BaseSyncHandler` over implementing this directly** — the base class
 * enforces version-based optimistic concurrency, schema validation, and
 * version increment, none of which this raw interface guarantees.
 *
 * Contract (binding for any direct implementer):
 *  - All DB writes MUST go through the provided `tx`. The caller treats the
 *    handler call as the transaction boundary; on exception or `conflict`/
 *    `rejected` result it rolls back.
 *  - Handlers MUST NOT trigger external side effects (HTTP, message bus,
 *    webhooks) inside `handle()`. Rollback cannot undo those. If integration
 *    is needed, write to an outbox table instead — a separate worker fans
 *    out post-commit.
 *  - On `conflict`, the handler MUST NOT have performed any write before
 *    returning. The version check must come before any `INSERT`/`UPDATE`.
 */
export interface SyncHandler<TRow extends object = Record<string, unknown>> {
  /** The sync table name this handler owns (matches `op.table` from clients). */
  readonly table: string;

  /** Apply a single push operation. See class docs for transaction contract. */
  handle(
    op: SyncOperation,
    userId: number,
    activeStoreId: number | null,
    tx: DbTransaction,
  ): Promise<SyncHandlerResult<TRow>>;

  /**
   * Fetch rows changed after the given compound cursor for pull sync.
   * Returns the mapped batch — handlers own row→SyncChange mapping AND the
   * per-table next cursor so the SyncService doesn't need to know row shapes.
   * Implementations should fetch `limit + 1` rows internally so they can
   * report `hasMore` accurately.
   */
  getChanges(
    cursorMs: number,
    cursorId: number,
    limit: number,
  ): Promise<SyncPullBatch>;
}

/**
 * Result of a pull-sync read for one table.
 *
 *   - `changes`     — wire-format payloads for mobile to apply locally.
 *   - `nextCursor`  — `"ts:id"` for this table; mobile stores it and sends
 *                     it back on the next pull. Empty result returns the
 *                     incoming cursor unchanged so mobile doesn't regress.
 *   - `hasMore`     — `true` if more rows exist past `limit`. Drives the
 *                     mobile "keep paging" loop on the same table.
 */
export interface SyncPullBatch {
  changes: SyncChange[];
  nextCursor: string;
  hasMore: boolean;
}
