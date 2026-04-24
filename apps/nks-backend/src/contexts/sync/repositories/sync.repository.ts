import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, sql, and, isNull, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../core/database/base.repository';
import { TransactionService } from '../../../core/database/transaction.service';
import * as schema from '../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

const parentRoutes = alias(schema.routes, 'parent_routes');

export interface RouteChangeRow {
  id: number;
  guuid: string;
  parentRouteGuuid: string | null;
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
  stateGuuid: string;
  isActive: boolean;
  updatedAt: Date;
  deletedAt: Date | null;
}

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
   * Fetch routes changed since a given compound cursor (timestamp + id).
   * Uses (updated_at, id) > (cursorTs, cursorId) to break ties when two rows
   * share the same updated_at, preventing silent data loss at page boundaries.
   * Fetches limit+1 rows to determine hasMore flag.
   */
  async getRouteChanges(
    cursorMs: number,
    cursorId: number,
    limit: number,
  ): Promise<RouteChangeRow[]> {
    const cursorDate = new Date(cursorMs);

    const rows = await this.db
      .select({
        id: schema.routes.id,
        guuid: schema.routes.guuid,
        parentRouteGuuid: parentRoutes.guuid,
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
      .leftJoin(parentRoutes, eq(schema.routes.parentRouteFk, parentRoutes.id))
      .where(
        sql`(${schema.routes.updatedAt}, ${schema.routes.id}) > (${cursorDate}, ${cursorId})`,
      )
      .orderBy(schema.routes.updatedAt, schema.routes.id)
      .limit(limit + 1);

    return rows as RouteChangeRow[];
  }

  /**
   * Fetch states changed since a given compound cursor (timestamp + id).
   * Uses (updated_at, id) > (cursorTs, cursorId) to break ties.
   */
  async getStateChanges(cursorMs: number, cursorId: number, limit: number): Promise<StateChangeRow[]> {
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
      .where(
        sql`(${schema.state.updatedAt}, ${schema.state.id}) > (${cursorDate}, ${cursorId})`,
      )
      .orderBy(schema.state.updatedAt, schema.state.id)
      .limit(limit + 1);
    return rows as StateChangeRow[];
  }

  /**
   * Fetch districts changed since a given compound cursor (timestamp + id).
   * Uses (updated_at, id) > (cursorTs, cursorId) to break ties.
   */
  async getDistrictChanges(cursorMs: number, cursorId: number, limit: number): Promise<DistrictChangeRow[]> {
    const cursorDate = new Date(cursorMs);
    const rows = await this.db
      .select({
        id: schema.district.id,
        guuid: schema.district.guuid,
        districtName: schema.district.districtName,
        districtCode: schema.district.districtCode,
        lgdCode: schema.district.lgdCode,
        stateGuuid: schema.state.guuid,
        isActive: schema.district.isActive,
        updatedAt: schema.district.updatedAt,
        deletedAt: schema.district.deletedAt,
      })
      .from(schema.district)
      .leftJoin(schema.state, eq(schema.district.stateFk, schema.state.id))
      .where(
        sql`(${schema.district.updatedAt}, ${schema.district.id}) > (${cursorDate}, ${cursorId})`,
      )
      .orderBy(schema.district.updatedAt, schema.district.id)
      .limit(limit + 1);
    return rows as DistrictChangeRow[];
  }

  /**
   * Look up a previously processed idempotency key.
   * Returns the stored request hash if found, null if not seen before.
   * Used to detect both duplicates and payload-mismatch replays.
   */
  async findProcessedEntry(key: string, tx?: Db): Promise<string | null> {
    const conn = tx ?? this.db;
    const rows = await conn
      .select({ requestHash: schema.idempotencyLog.requestHash })
      .from(schema.idempotencyLog)
      .where(eq(schema.idempotencyLog.key, key))
      .limit(1);

    return rows.length > 0 ? rows[0].requestHash : null;
  }

  /**
   * Record an idempotency key as processed with its request hash.
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
   * Run a callback inside a database transaction via TransactionService.
   */
  async withTransaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
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
