import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, gt, and, isNull, or } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import * as schema from '../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

export interface RouteChangeRow {
  id: number;
  guuid: string;
  parentRouteFk: number | null;
  routeName: string;
  routePath: string;
  fullPath: string;
  description: string | null;
  iconName: string | null;
  routeType: string;
  routeScope: string;
  isPublic: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class SyncRepository {
  constructor(@InjectDb() private readonly db: Db) {}

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
          isNull(schema.storeUserMapping.deletedAt),
        ),
      )
      .where(
        and(
          eq(schema.store.guuid, storeGuuid),
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
   * Fetch routes changed since a given timestamp.
   * Queries routes WHERE updated_at > cursorMs (millisecond epoch).
   * Fetches limit+1 rows to determine hasMore flag.
   * Returns full rows including deleted_at field (null = active, non-null = soft-deleted).
   */
  async getRouteChanges(
    cursorMs: number,
    limit: number,
  ): Promise<RouteChangeRow[]> {
    const cursorDate = new Date(cursorMs);

    const rows = await this.db
      .select({
        id: schema.routes.id,
        guuid: schema.routes.guuid,
        parentRouteFk: schema.routes.parentRouteFk,
        routeName: schema.routes.routeName,
        routePath: schema.routes.routePath,
        fullPath: schema.routes.fullPath,
        description: schema.routes.description,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
        isPublic: schema.routes.isPublic,
        isActive: schema.routes.isActive,
        createdAt: schema.routes.createdAt,
        updatedAt: schema.routes.updatedAt,
        deletedAt: schema.routes.deletedAt,
      })
      .from(schema.routes)
      .where(gt(schema.routes.updatedAt, cursorDate))
      .orderBy(schema.routes.updatedAt)
      .limit(limit + 1);

    return rows as RouteChangeRow[];
  }

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
  async logIdempotencyKey(key: string, requestHash: string, tx?: Db): Promise<void> {
    const conn = tx ?? this.db;
    await conn.insert(schema.idempotencyLog).values({
      key,
      requestHash,
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
