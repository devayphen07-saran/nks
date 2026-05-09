import { Injectable } from '@nestjs/common';
import { eq, isNull, and, or, sql, exists, inArray, desc, asc } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import type { DbTransaction } from '../../../../core/database/transaction.service';

type Db = NodePgDatabase<typeof schema>;

export interface UserStoreRow {
  id: number;
  guuid: string;
  storeName: string;
  storeCode: string | null;
  storeStatus: string;
  isVerified: boolean;
  isDefault: boolean;
  timezone: string;
  createdAt: Date;
  isOwner: boolean;
}

/** Primary phone for an entity record — first row by `is_primary DESC, id ASC`. */
export interface RecordPhone {
  recordId: number;
  phoneNumber: string;
}

/** Primary address line for an entity record — first row by `is_default_address DESC, id ASC`. */
export interface RecordAddress {
  recordId: number;
  line1: string | null;
  line2: string | null;
  cityName: string | null;
}

@Injectable()
export class StoresRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) {
    super(db);
  }

  /**
   * Returns the store only if it is active and not soft-deleted.
   * Used by RBACGuard — returns null for deleted or inactive stores.
   */
  async findActiveById(id: number): Promise<{ id: number } | null> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, id),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * True iff the user is the ownerUserFk of the given active store.
   * Used by RBACGuard to bypass the role-row membership check for store owners.
   */
  async isOwner(userId: number, storeId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, storeId),
          eq(schema.store.ownerUserFk, userId),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  /**
   * Single-query active + ownership check for RBACGuard.
   * Returns null when the store does not exist, is inactive, or is soft-deleted.
   * Returns { isOwner } when the store is active — isOwner is true iff
   * ownerUserFk matches userId.
   *
   * Replaces the two-query pattern (findActiveById then isOwner) that had a
   * TOCTOU window where the store could be deactivated between the two calls.
   */
  async findActiveWithOwnership(
    userId: number,
    storeId: number,
  ): Promise<{ isOwner: boolean } | null> {
    const [row] = await this.db
      .select({
        isOwner: sql<boolean>`(${schema.store.ownerUserFk} = ${userId})`,
      })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, storeId),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Set a store as the user's default by toggling is_default on the store table.
   * Clears is_default on any previous default owned by this user first.
   * Pass storeId=null to clear the default (admin path — no membership check).
   *
   * The two updates MUST run inside the same transaction so concurrent callers
   * cannot both clear the old default and then both try to set their own — the
   * partial unique index `store_owner_default_uidx` would otherwise reject the
   * second writer with a confusing constraint error. Callers must therefore
   * pass a tx; the service layer owns transaction management via
   * TransactionService.
   */
  async setDefaultStore(
    userId: number,
    storeId: number | null,
    tx: DbTransaction,
  ): Promise<void> {
    await tx
      .update(schema.store)
      .set({ isDefault: false })
      .where(and(eq(schema.store.ownerUserFk, userId), eq(schema.store.isDefault, true)));

    if (storeId !== null) {
      await tx
        .update(schema.store)
        .set({ isDefault: true })
        .where(and(eq(schema.store.id, storeId), eq(schema.store.ownerUserFk, userId)));
    }
  }

  /**
   * Atomically verify membership and set default store.
   * Clears previous default, then sets is_default=true on the target store.
   * Returns true if the store belongs to the user (owner or staff), false otherwise.
   *
   * Caller must pass a tx so the membership check and the default-toggle run
   * in the same snapshot.
   */
  async setDefaultStoreIfMember(
    userId: number,
    storeId: number,
    tx: DbTransaction,
  ): Promise<boolean> {
    const isMember = await tx
      .select({ x: sql`1` })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.id, storeId),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
          or(
            eq(schema.store.ownerUserFk, userId),
            exists(
              tx
                .select({ x: sql`1` })
                .from(schema.storeUserMapping)
                .where(
                  and(
                    eq(schema.storeUserMapping.storeFk, storeId),
                    eq(schema.storeUserMapping.userFk, userId),
                    eq(schema.storeUserMapping.isActive, true),
                    isNull(schema.storeUserMapping.deletedAt),
                  ),
                ),
            ),
          ),
        ),
      )
      .limit(1);

    if (!isMember.length) return false;

    await this.setDefaultStore(userId, storeId, tx);
    return true;
  }

  /**
   * Find a store by guuid (active, not deleted).
   */
  async findByGuuid(
    guuid: string,
  ): Promise<{ id: number; guuid: string } | null> {
    const [row] = await this.db
      .select({ id: schema.store.id, guuid: schema.store.guuid })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.guuid, guuid),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async getStoresForUser(userId: number): Promise<UserStoreRow[]> {
    // Single LEFT JOIN query: owner takes priority over staff membership via CASE.
    // A user who is both owner and mapped as staff is returned once with isOwner=true.
    const rows = await this.db
      .select({
        id:          schema.store.id,
        guuid:       schema.store.guuid,
        storeName:   schema.store.storeName,
        storeCode:   schema.store.storeCode,
        storeStatus: schema.status.code,
        isVerified:  schema.store.isVerified,
        isDefault:   schema.store.isDefault,
        timezone:    schema.store.timezone,
        createdAt:   schema.store.createdAt,
        isOwner:     sql<boolean>`(${schema.store.ownerUserFk} = ${userId})`,
      })
      .from(schema.store)
      .innerJoin(schema.status, eq(schema.store.statusFk, schema.status.id))
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
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
          or(
            eq(schema.store.ownerUserFk, userId),
            eq(schema.storeUserMapping.userFk, userId),
          ),
        ),
      );

    return rows;
  }

  /**
   * Load primary phone for each record id (Ayphen polymorphic pattern).
   * Returns one row per recordId — the row with `is_primary = true` if present,
   * otherwise the lowest-id active row that has a non-null phone.
   *
   * Caller passes `entityId` already resolved from `entity.entity_name` via
   * EntityRegistryService. The repository does NOT join on the `entity` table.
   */
  async getPrimaryPhonesForRecords(
    entityId: number,
    recordIds: number[],
  ): Promise<RecordPhone[]> {
    if (recordIds.length === 0) return [];

    // DISTINCT ON gives us exactly one row per record_id, picking the row
    // ordered by (is_primary DESC, id ASC) — Postgres-specific but indexed
    // and far cheaper than a window function for this row count.
    const rows = await this.db
      .select({
        recordId:    schema.communication.recordId,
        phoneNumber: schema.communication.phoneNumber,
      })
      .from(schema.communication)
      .where(
        and(
          eq(schema.communication.entityFk, entityId),
          inArray(schema.communication.recordId, recordIds),
          eq(schema.communication.isActive, true),
          isNull(schema.communication.deletedAt),
          sql`${schema.communication.phoneNumber} IS NOT NULL`,
        ),
      )
      .orderBy(
        asc(schema.communication.recordId),
        desc(schema.communication.isPrimary),
        asc(schema.communication.id),
      );

    // Application-side dedup by recordId — first row wins thanks to ORDER BY.
    // Avoids relying on Postgres-specific DISTINCT ON in the query builder.
    const result: RecordPhone[] = [];
    let lastRecordId: number | null = null;
    for (const row of rows) {
      if (row.recordId === lastRecordId || row.phoneNumber === null) continue;
      result.push({ recordId: row.recordId, phoneNumber: row.phoneNumber });
      lastRecordId = row.recordId;
    }
    return result;
  }

  /**
   * Load primary address for each record id (Ayphen polymorphic pattern).
   * Returns one row per recordId — the default address if present, otherwise
   * the lowest-id active address.
   */
  async getPrimaryAddressesForRecords(
    entityId: number,
    recordIds: number[],
  ): Promise<RecordAddress[]> {
    if (recordIds.length === 0) return [];

    const rows = await this.db
      .select({
        recordId: schema.address.recordId,
        line1:    schema.address.line1,
        line2:    schema.address.line2,
        cityName: schema.address.cityName,
      })
      .from(schema.address)
      .where(
        and(
          eq(schema.address.entityFk, entityId),
          inArray(schema.address.recordId, recordIds),
          eq(schema.address.isActive, true),
          isNull(schema.address.deletedAt),
        ),
      )
      .orderBy(
        asc(schema.address.recordId),
        desc(schema.address.isDefaultAddress),
        asc(schema.address.id),
      );

    const result: RecordAddress[] = [];
    let lastRecordId: number | null = null;
    for (const row of rows) {
      if (row.recordId === lastRecordId) continue;
      result.push(row);
      lastRecordId = row.recordId;
    }
    return result;
  }
}
