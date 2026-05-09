import { eq } from 'drizzle-orm';
import { getDatabase } from '../connection';
import { mutationQueueLog } from '../schema';
import type { MutationQueueLogRow } from '../schema';

/**
 * Permanent log of mutations that were successfully sent to the server.
 *
 * Used for FIX #10 deduplication: before sending a mutation we check the log
 * by idempotency key. If we find an entry, the server already accepted it on
 * a prior attempt and we skip the push.
 */
export type MutationLogStatus = 'ok' | 'duplicate' | 'rejected' | 'failed';

export class MutationQueueLogRepository {
  private get db() { return getDatabase(); }

  async record(params: {
    idempotencyKey: string;
    mutationId?:    number;
    resultId?:      string;
    status:         MutationLogStatus;
    serverTimestamp?: number;
  }): Promise<void> {
    await this.db.insert(mutationQueueLog).values({
      idempotencyKey:  params.idempotencyKey,
      mutationId:      params.mutationId ?? null,
      resultId:        params.resultId ?? null,
      status:          params.status,
      serverTimestamp: params.serverTimestamp ?? null,
      createdAt:       Date.now(),
    });
  }

  async findByKey(idempotencyKey: string): Promise<MutationQueueLogRow | null> {
    const rows = await this.db
      .select()
      .from(mutationQueueLog)
      .where(eq(mutationQueueLog.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  }

  async isAlreadySynced(idempotencyKey: string): Promise<boolean> {
    const entry = await this.findByKey(idempotencyKey);
    return entry?.status === 'ok' || entry?.status === 'duplicate';
  }

  async clear(): Promise<void> {
    await this.db.delete(mutationQueueLog);
  }
}

export const mutationQueueLogRepository = new MutationQueueLogRepository();
