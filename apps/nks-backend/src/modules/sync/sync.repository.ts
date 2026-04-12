import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class SyncRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Check if an idempotency key has already been processed.
   */
  async isAlreadyProcessed(key: string, tx?: Db): Promise<boolean> {
    const conn = tx ?? this.db;
    const rows = await conn
      .select({ key: schema.idempotencyLog.key })
      .from(schema.idempotencyLog)
      .where(eq(schema.idempotencyLog.key, key))
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Record an idempotency key as processed.
   * Must be called inside the same transaction as the mutation.
   */
  async logIdempotencyKey(key: string, tx?: Db): Promise<void> {
    const conn = tx ?? this.db;
    await conn.insert(schema.idempotencyLog).values({
      key,
      processedAt: new Date(),
    });
  }

  /**
   * Run a callback inside a database transaction.
   */
  async withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
    return this.db.transaction(fn);
  }

  /**
   * Delete idempotency entries older than the specified number of days.
   * Called by a scheduled cleanup job.
   */
  async deleteOldIdempotencyEntries(olderThanDays: number = 7): Promise<void> {
    const cutoff = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000,
    );
    await this.db.execute(
      sql`DELETE FROM idempotency_log WHERE processed_at < ${cutoff}`,
    );
  }
}
