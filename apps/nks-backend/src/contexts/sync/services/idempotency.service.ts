import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import { processedOperations } from '../../../core/database/schema';
import type { SyncResult } from '../types/sync-result';

/**
 * IdempotencyService deduplicates push operations.
 *
 * When a mobile device sends the same operation twice (network retry, app crash),
 * the second request returns the cached result from the first attempt.
 *
 * CRITICAL: Only terminal results (ok, duplicate, conflict, rejected) are cached.
 * Errors and unknown-entity responses are NOT cached. This allows the device to
 * retry safely even after transient failures or before a domain handler deploys.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Look up a cached operation result by clientOpId.
   *
   * @param clientOpId - UUID generated on the device
   * @returns Cached result or null if not found (or expired, handled by cleanup scheduler)
   */
  async find(clientOpId: string): Promise<SyncResult | null> {
    const rows = await this.db
      .select()
      .from(processedOperations)
      .where(eq(processedOperations.clientOpId, clientOpId as any))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return row.result as SyncResult;
  }

  /**
   * Save an operation result (only if terminal).
   *
   * Terminal results: ok, duplicate, conflict, rejected
   * Non-terminal (never saved): error, unknown_entity
   *
   * Errors are transient — device retries safely.
   * Unknown entities are not cached so retries succeed after deployment.
   *
   * Uses INSERT ... ON CONFLICT DO NOTHING for race safety.
   * If two requests race, whichever inserts first wins. The second hits
   * the same row on find() and returns the same result. Safe.
   *
   * @param clientOpId - UUID from the device
   * @param deviceId - Stable device identifier for auditing
   * @param entityType - Entity being modified (customer, product, etc.)
   * @param result - The result to cache
   */
  async save(
    clientOpId: string,
    deviceId: string,
    entityType: string,
    result: SyncResult,
  ): Promise<void> {
    // Only cache terminal results.
    if (result.status === 'error') {
      return;
    }

    await this.db
      .insert(processedOperations)
      .values({
        clientOpId: clientOpId as any,
        deviceId,
        entityType,
        result: result as any,
      })
      .onConflictDoNothing()
      .execute();
  }
}
