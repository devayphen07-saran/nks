/**
 * MutationQueueRepository
 *
 * Status flow:
 *   enqueue()         → 'pending'
 *   findBatch()       → only 'pending' where backoff elapsed
 *   markInProgress()  → 'in_progress'   (before HTTP send)
 *   markSynced()      → 'synced' → delete
 *   incrementRetry()  → 'pending' + backoff  OR  'quarantined' at max
 *   markQuarantined() → 'quarantined'   (kept forever — audit trail)
 *   resetStuck()      → 'in_progress' → 'pending'  (app startup crash recovery)
 *   resetToRetry()    → 'pending'   (after auth refresh, clear backoff)
 */

import { eq, and, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { mutationQueue } from '../schema';
import type { MutationQueueRow } from '../schema';
import { createLogger } from '../../utils/logger';
import { uuidv7 } from 'uuidv7';

const log = createLogger('MutationQueueRepository');

// Exponential backoff: 30s → 2m → 8m → 32m → 120m (capped)
const BACKOFF_MS = [30_000, 120_000, 480_000, 1_920_000, 7_200_000];
const backoffMs = (retries: number) => BACKOFF_MS[Math.min(retries, BACKOFF_MS.length - 1)];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MutationQueueItem {
  id:              number;
  idempotency_key: string;
  operation:       string;
  entity:          string;
  payload:         Record<string, unknown>;
  status:          string;
  retries:         number;
  max_retries:     number;
}

export type MutationStatus = 'pending' | 'in_progress' | 'synced' | 'failed' | 'quarantined';

// ─── Repository ───────────────────────────────────────────────────────────────

export class MutationQueueRepository {
  private get db() { return getDatabase(); }

  // ── Enqueue ────────────────────────────────────────────────────────────────

  async enqueue(
    operation: string,
    entity:    string,
    payload:   Record<string, unknown>,
    deviceId = '',
    maxRetries = 5,
  ): Promise<void> {
    try {
      await this.db.insert(mutationQueue).values({
        idempotency_key: uuidv7(),
        operation,
        entity,
        payload:     JSON.stringify(payload),
        status:      'pending',
        retries:     0,
        max_retries: maxRetries,
        device_id:   deviceId,
        created_at:  Date.now(),
      });
      log.debug(`Enqueued ${operation} on ${entity}`);
    } catch (err) {
      log.error('Failed to enqueue mutation:', err);
      throw err;
    }
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  /**
   * Fetch the next batch of mutations ready to send.
   * Only returns 'pending' rows where next_retry_at has elapsed (or is null).
   * FIFO order via id ASC.
   */
  async findBatch(limit = 50): Promise<MutationQueueItem[]> {
    try {
      const now = Date.now();
      const rows: MutationQueueRow[] = await this.db
        .select()
        .from(mutationQueue)
        .where(
          and(
            eq(mutationQueue.status, 'pending'),
            or(
              isNull(mutationQueue.next_retry_at),
              lte(mutationQueue.next_retry_at, now),
            ),
          ),
        )
        .orderBy(mutationQueue.id)
        .limit(limit);

      const items: MutationQueueItem[] = [];
      for (const row of rows) {
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(row.payload) as Record<string, unknown>;
        } catch {
          log.warn(`Corrupted payload for id=${row.id} — quarantining`);
          await this.markQuarantined(row.id, 0, 'Corrupted JSON payload');
          continue;
        }
        items.push({
          id:              row.id,
          idempotency_key: row.idempotency_key,
          operation:       row.operation,
          entity:          row.entity,
          payload,
          status:          row.status,
          retries:         row.retries,
          max_retries:     row.max_retries,
        });
      }
      return items;
    } catch (err) {
      log.error('Failed to fetch mutation batch:', err);
      return [];
    }
  }

  // ── Status Transitions ─────────────────────────────────────────────────────

  async markInProgress(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(mutationQueue)
        .set({ status: 'in_progress' })
        .where(inArray(mutationQueue.id, ids));
    } catch (err) {
      log.error('Failed to mark in_progress:', err);
    }
  }

  async markSynced(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(mutationQueue)
        .set({ status: 'synced', synced_at: Date.now() })
        .where(inArray(mutationQueue.id, ids));
      // Delete immediately — synced rows are not needed
      await this.db
        .delete(mutationQueue)
        .where(inArray(mutationQueue.id, ids));
      log.debug(`Synced and deleted ${ids.length} mutations`);
    } catch (err) {
      log.error('Failed to mark synced:', err);
    }
  }

  /**
   * Increment retry and schedule backoff.
   * Quarantines automatically when max_retries is reached.
   */
  async incrementRetry(id: number, errorMsg?: string): Promise<void> {
    try {
      const current = await this.db
        .select({ retries: mutationQueue.retries, max_retries: mutationQueue.max_retries })
        .from(mutationQueue)
        .where(eq(mutationQueue.id, id))
        .limit(1);

      if (!current[0]) return;

      const newRetries = current[0].retries + 1;

      if (newRetries >= current[0].max_retries) {
        await this.markQuarantined(id, 0, errorMsg ?? 'Max retries exceeded');
        return;
      }

      await this.db
        .update(mutationQueue)
        .set({
          status:         'pending',
          retries:        sql`${mutationQueue.retries} + 1`,  // atomic
          next_retry_at:  Date.now() + backoffMs(newRetries),
          last_error_msg: errorMsg ?? null,
        })
        .where(eq(mutationQueue.id, id));

      log.debug(`Retry ${newRetries}/${current[0].max_retries} for id=${id}, next in ${backoffMs(newRetries)}ms`);
    } catch (err) {
      log.error('Failed to increment retry:', err);
    }
  }

  /** Permanently quarantine — row kept for audit trail, never deleted. */
  async markQuarantined(id: number, errorCode: number, errorMsg: string): Promise<void> {
    try {
      await this.db
        .update(mutationQueue)
        .set({ status: 'quarantined', last_error_code: errorCode, last_error_msg: errorMsg, next_retry_at: null })
        .where(eq(mutationQueue.id, id));
      log.warn(`Quarantined id=${id}: [${errorCode}] ${errorMsg}`);
    } catch (err) {
      log.error('Failed to quarantine:', err);
    }
  }

  /** Reset specific ids back to pending immediately (clears backoff). */
  async resetToRetry(ids: number[]): Promise<void> {
    if (!ids.length) return;
    try {
      await this.db
        .update(mutationQueue)
        .set({ status: 'pending', next_retry_at: null })
        .where(inArray(mutationQueue.id, ids));
    } catch (err) {
      log.error('Failed to reset to retry:', err);
    }
  }

  /**
   * Crash recovery — reset all 'in_progress' back to 'pending'.
   * Call once at app startup. Safe because server uses idempotency_key for dedup.
   */
  async resetStuck(): Promise<number> {
    try {
      const stuck = await this.db
        .select({ id: mutationQueue.id })
        .from(mutationQueue)
        .where(eq(mutationQueue.status, 'in_progress'));

      if (!stuck.length) return 0;

      await this.db
        .update(mutationQueue)
        .set({ status: 'pending', next_retry_at: null })
        .where(eq(mutationQueue.status, 'in_progress'));

      return stuck.length;
    } catch (err) {
      log.error('Failed to reset stuck:', err);
      return 0;
    }
  }

  // ── Observability ──────────────────────────────────────────────────────────

  async countByStatus(status: MutationStatus): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(mutationQueue)
        .where(eq(mutationQueue.status, status));
      return result[0]?.count ?? 0;
    } catch {
      return 0;
    }
  }

  async findQuarantined(): Promise<MutationQueueItem[]> {
    try {
      const rows = await this.db
        .select()
        .from(mutationQueue)
        .where(eq(mutationQueue.status, 'quarantined'))
        .orderBy(mutationQueue.id);

      return rows.map(row => ({
        id:              row.id,
        idempotency_key: row.idempotency_key,
        operation:       row.operation,
        entity:          row.entity,
        payload:         (() => { try { return JSON.parse(row.payload); } catch { return {}; } })(),
        status:          row.status,
        retries:         row.retries,
        max_retries:     row.max_retries,
      }));
    } catch (err) {
      log.error('Failed to fetch quarantined:', err);
      return [];
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  async clear(): Promise<void> {
    try {
      await this.db.delete(mutationQueue);
    } catch (err) {
      log.error('Failed to clear mutation queue:', err);
    }
  }
}

export const mutationQueueRepository = new MutationQueueRepository();
