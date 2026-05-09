import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Registration describing how to hard-delete soft-deleted rows from a table
 * once they pass the retention window.
 *
 * IMPORTANT before registering a table:
 *   1. **FK constraints** — if other tables reference this row with
 *      `ON DELETE restrict`, hard delete will fail. Either drop the dependent
 *      rows first, switch the FK to SET NULL, or use anonymisation instead of
 *      hard delete.
 *   2. **Sync TTL** — soft-deleted rows are surfaced to mobile clients with
 *      `deleted_at` set so they apply the delete locally. Retention MUST be
 *      longer than the maximum offline window (current default: 90 days)
 *      otherwise late-syncing clients will keep stale rows forever.
 *   3. **Audit / legal hold** — confirm there is no retention requirement
 *      mandated by compliance before purging.
 */
export interface ArchivalTarget {
  /** Stable identifier for env config: `ARCHIVAL_<NAME>_RETENTION_DAYS`. */
  readonly name: string;
  /** Drizzle table reference. Must have `deletedAt` and an `id` column. */
  readonly table: PgTable & {
    deletedAt: { name: string };
    id: { name: string };
  };
  /** Days a soft-deleted row lives before purge. Must exceed sync TTL. */
  readonly retentionDays: number;
  /** Cap rows deleted per run so a long backlog doesn't lock the table. */
  readonly batchSize?: number;
}

export const ARCHIVAL_TARGETS = Symbol('ARCHIVAL_TARGETS');