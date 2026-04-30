import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, and, isNull, or } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../core/database/base.repository';
import { TransactionService } from '../../../core/database/transaction.service';
import type { DbTransaction } from '../../../core/database/transaction.service';
import * as schema from '../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Sync-specific meta operations: store membership + idempotency log.
 *
 * Domain-specific change-feed reads (state, district, etc.) live in the
 * domain repositories — each sync handler owns its read via `getChanges()`.
 */
@Injectable()
export class SyncRepository extends BaseRepository {
  constructor(
    @InjectDb() db: Db,
    private readonly txService: TransactionService,
  ) { super(db); }

  /**
   * Verify that a user belongs to a store via store_user_mapping.
   * Returns the numeric store ID if membership exists and is active (not soft-deleted).
   * Returns null if user does not belong to this store.
   */
  async verifyStoreMembership(
    userId: number,
    storeGuuid: string,
  ): Promise<number | null> {
    const rows = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .leftJoin(
        schema.storeUserMapping,
        and(
          eq(schema.storeUserMapping.storeFk, schema.store.id),
          eq(schema.storeUserMapping.userFk, userId),
          eq(schema.storeUserMapping.isActive, true),
          isNull(schema.storeUserMapping.deletedAt),
        ),
      )
      .where(
        and(
          eq(schema.store.guuid, storeGuuid),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
          or(
            eq(schema.store.ownerUserFk, userId),
            eq(schema.storeUserMapping.userFk, userId),
          ),
        ),
      )
      .limit(1);

    return rows.length > 0 ? rows[0].id : null;
  }

  /**
   * Atomically claim an idempotency key.
   *
   * Uses INSERT ... ON CONFLICT DO NOTHING RETURNING to avoid the TOCTOU window
   * that exists in a separate SELECT + INSERT pattern: at READ COMMITTED isolation,
   * two concurrent transactions can both SELECT "not found" and then race to INSERT,
   * causing the second to fail with a PK violation and roll back the entire batch.
   *
   * PostgreSQL row-level locking during INSERT ensures only one transaction
   * proceeds per key — the second blocks until the first commits or rolls back,
   * then detects the conflict cleanly via ON CONFLICT rather than a crash.
   *
   * Returns true  → this transaction owns the key; proceed with the operation.
   * Returns false → key already exists (committed by an earlier transaction);
   *                 caller should SELECT the stored hash to distinguish a
   *                 legitimate duplicate from a tampered replay.
   *
   * Must be called inside the same transaction as the mutation so that a failed
   * operation rolls back the claim — leaving the key available for a clean retry.
   */
  async claimIdempotencyKey(key: string, requestHash: string, tx: DbTransaction): Promise<boolean> {
    const rows = await tx
      .insert(schema.idempotencyLog)
      .values({ key, requestHash, processedAt: new Date() })
      .onConflictDoNothing()
      .returning({ key: schema.idempotencyLog.key });
    return rows.length > 0;
  }

  /**
   * Fetch the stored request hash for an already-processed idempotency key.
   * Used after claimIdempotencyKey() returns false to distinguish a legitimate
   * duplicate (same hash) from a payload-mismatch replay (different hash).
   */
  async getStoredHash(key: string, tx: DbTransaction): Promise<string | null> {
    const rows = await tx
      .select({ requestHash: schema.idempotencyLog.requestHash })
      .from(schema.idempotencyLog)
      .where(eq(schema.idempotencyLog.key, key))
      .limit(1);
    return rows.length > 0 ? rows[0].requestHash : null;
  }

  /**
   * Run a callback inside a database transaction via TransactionService.
   */
  async withTransaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.txService.run(fn);
  }

  /**
   * Delete expired idempotency entries.
   * Uses the indexed `expires_at` column for efficient cleanup.
   * Called by a scheduled cleanup job.
   */
  async deleteExpiredIdempotencyEntries(): Promise<void> {
    await this.db.execute(
      sql`DELETE FROM idempotency_log WHERE expires_at < NOW()`,
    );
  }
}
