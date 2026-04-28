import { eq, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { failedOperations } from '../schema';
import type { FailedOperationRow } from '../schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('FailedOperationsRepository');

export interface FailedOperationItem {
  id:              number;
  idempotency_key: string;
  operation:       string;
  entity:          string;
  payload:         Record<string, unknown>;
  error_code:      number | null;
  error_msg:       string | null;
  device_id:       string;
  created_at:      number;
  failed_at:       number;
  resolved:        boolean;
  resolved_at:     number | null;
}

export class FailedOperationsRepository {
  private get db() { return getDatabase(); }

  // ── Write ──────────────────────────────────────────────────────────────────

  /** Move a mutation from the queue into the dead-letter store. */
  async insert(params: {
    idempotency_key: string;
    operation:       string;
    entity:          string;
    payload:         Record<string, unknown>;
    error_code?:     number;
    error_msg?:      string;
    device_id?:      string;
    created_at:      number;
  }): Promise<void> {
    try {
      await this.db.insert(failedOperations).values({
        idempotency_key: params.idempotency_key,
        operation:       params.operation,
        entity:          params.entity,
        payload:         JSON.stringify(params.payload),
        error_code:      params.error_code ?? null,
        error_msg:       params.error_msg ?? null,
        device_id:       params.device_id ?? '',
        created_at:      params.created_at,
        failed_at:       Date.now(),
        resolved:        0,
      }).onConflictDoNothing(); // idempotent — duplicate quarantine calls are no-ops
      log.debug(`Inserted failed op: ${params.idempotency_key} (${params.entity}/${params.operation})`);
    } catch (err) {
      log.error('Failed to insert dead-letter op:', err);
      throw err;
    }
  }

  /** Mark a failed operation as resolved (admin action). */
  async markResolved(id: number): Promise<void> {
    try {
      await this.db
        .update(failedOperations)
        .set({ resolved: 1, resolved_at: Date.now() })
        .where(eq(failedOperations.id, id));
    } catch (err) {
      log.error(`Failed to mark resolved id=${id}:`, err);
    }
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  async findAll(): Promise<FailedOperationItem[]> {
    try {
      const rows = await this.db
        .select()
        .from(failedOperations)
        .orderBy(failedOperations.failed_at);
      return rows.map(this._toItem);
    } catch (err) {
      log.error('Failed to fetch all failed ops:', err);
      return [];
    }
  }

  async findUnresolved(): Promise<FailedOperationItem[]> {
    try {
      const rows = await this.db
        .select()
        .from(failedOperations)
        .where(eq(failedOperations.resolved, 0))
        .orderBy(failedOperations.failed_at);
      return rows.map(this._toItem);
    } catch (err) {
      log.error('Failed to fetch unresolved failed ops:', err);
      return [];
    }
  }

  async countUnresolved(): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(failedOperations)
        .where(eq(failedOperations.resolved, 0));
      return result[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private _toItem(row: FailedOperationRow): FailedOperationItem {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    return {
      id:              row.id,
      idempotency_key: row.idempotency_key,
      operation:       row.operation,
      entity:          row.entity,
      payload,
      error_code:      row.error_code ?? null,
      error_msg:       row.error_msg ?? null,
      device_id:       row.device_id,
      created_at:      row.created_at,
      failed_at:       row.failed_at,
      resolved:        row.resolved === 1,
      resolved_at:     row.resolved_at ?? null,
    };
  }
}

export const failedOperationsRepository = new FailedOperationsRepository();
