import { Injectable } from '@nestjs/common';
import { eq, isNull, and, or, sql, exists } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';

type Db = NodePgDatabase<typeof schema>;

export interface UserStoreRow {
  id: number;
  guuid: string;
  storeName: string;
  storeCode: string | null;
  storeStatus: string;
  isVerified: boolean;
  createdAt: Date;
  isOwner: boolean;
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
   * Set the user's default store. Pass null to clear (admin path — no membership check).
   */
  async setDefaultStore(userId: number, storeId: number | null): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ defaultStoreFk: storeId })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Atomically verify membership and set default store in a single UPDATE.
   * Returns true if updated (user is owner or mapped staff), false if the
   * membership check failed (caller should throw ForbiddenException).
   *
   * The EXISTS subqueries run inside the UPDATE WHERE clause — no separate
   * SELECT + UPDATE race condition.
   */
  async setDefaultStoreIfMember(userId: number, storeId: number): Promise<boolean> {
    const updated = await this.db
      .update(schema.users)
      .set({ defaultStoreFk: storeId })
      .where(
        and(
          eq(schema.users.id, userId),
          or(
            exists(
              this.db
                .select({ x: sql`1` })
                .from(schema.store)
                .where(
                  and(
                    eq(schema.store.id, storeId),
                    eq(schema.store.ownerUserFk, userId),
                    eq(schema.store.isActive, true),
                    isNull(schema.store.deletedAt),
                  ),
                ),
            ),
            exists(
              this.db
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
      .returning({ id: schema.users.id });
    return updated.length > 0;
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
        id: schema.store.id,
        guuid: schema.store.guuid,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        storeStatus: schema.store.storeStatus,
        isVerified: schema.store.isVerified,
        createdAt: schema.store.createdAt,
        isOwner: sql<boolean>`(${schema.store.ownerUserFk} = ${userId})`,
      })
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
}
