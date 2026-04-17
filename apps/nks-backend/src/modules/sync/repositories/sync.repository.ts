import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, gt, and, isNull, or } from 'drizzle-orm';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';

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

export interface StateChangeRow {
  id: number;
  guuid: string;
  stateName: string;
  stateCode: string;
  gstStateCode: string | null;
  isUnionTerritory: boolean;
  isActive: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface DistrictChangeRow {
  id: number;
  guuid: string;
  districtName: string;
  districtCode: string | null;
  lgdCode: string | null;
  stateFk: number;
  isActive: boolean;
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
   * Fetch states changed since a given timestamp.
   * Returns full rows including deleted_at for soft-delete propagation.
   */
  async getStateChanges(cursorMs: number, limit: number): Promise<StateChangeRow[]> {
    const cursorDate = new Date(cursorMs);
    const rows = await this.db
      .select({
        id: schema.state.id,
        guuid: schema.state.guuid,
        stateName: schema.state.stateName,
        stateCode: schema.state.stateCode,
        gstStateCode: schema.state.gstStateCode,
        isUnionTerritory: schema.state.isUnionTerritory,
        isActive: schema.state.isActive,
        updatedAt: schema.state.updatedAt,
        deletedAt: schema.state.deletedAt,
      })
      .from(schema.state)
      .where(gt(schema.state.updatedAt, cursorDate))
      .orderBy(schema.state.updatedAt)
      .limit(limit + 1);
    return rows as StateChangeRow[];
  }

  /**
   * Fetch districts changed since a given timestamp.
   * Returns full rows including deleted_at for soft-delete propagation.
   */
  async getDistrictChanges(cursorMs: number, limit: number): Promise<DistrictChangeRow[]> {
    const cursorDate = new Date(cursorMs);
    const rows = await this.db
      .select({
        id: schema.district.id,
        guuid: schema.district.guuid,
        districtName: schema.district.districtName,
        districtCode: schema.district.districtCode,
        lgdCode: schema.district.lgdCode,
        stateFk: schema.district.stateFk,
        isActive: schema.district.isActive,
        updatedAt: schema.district.updatedAt,
        deletedAt: schema.district.deletedAt,
      })
      .from(schema.district)
      .where(gt(schema.district.updatedAt, cursorDate))
      .orderBy(schema.district.updatedAt)
      .limit(limit + 1);
    return rows as DistrictChangeRow[];
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
