import { Injectable } from '@nestjs/common';
import { eq, isNull, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';

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
export class StoresRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Returns all stores the user has access to:
   * - Owned stores (ownerUserFk = userId)
   * - Staff stores (storeUserMapping.userFk = userId, active membership)
   * Includes isOwner flag to distinguish the two.
   */
  async getStoresForUser(userId: number): Promise<UserStoreRow[]> {
    // 1. Owned stores
    const ownedStores = await this.db
      .select({
        id: schema.store.id,
        guuid: schema.store.guuid,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        storeStatus: schema.store.storeStatus,
        isVerified: schema.store.isVerified,
        createdAt: schema.store.createdAt,
      })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.ownerUserFk, userId),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      );

    // 2. Staff stores (user has mapping but is not the owner)
    const staffStores = await this.db
      .select({
        id: schema.store.id,
        guuid: schema.store.guuid,
        storeName: schema.store.storeName,
        storeCode: schema.store.storeCode,
        storeStatus: schema.store.storeStatus,
        isVerified: schema.store.isVerified,
        createdAt: schema.store.createdAt,
      })
      .from(schema.store)
      .innerJoin(
        schema.storeUserMapping,
        eq(schema.storeUserMapping.storeFk, schema.store.id),
      )
      .where(
        and(
          eq(schema.storeUserMapping.userFk, userId),
          eq(schema.storeUserMapping.isActive, true),
          isNull(schema.storeUserMapping.deletedAt),
        ),
      );

    const ownedIds = new Set(ownedStores.map((s) => s.id));

    return [
      ...ownedStores.map((s) => ({ ...s, isOwner: true })),
      ...staffStores
        .filter((s) => !ownedIds.has(s.id))
        .map((s) => ({ ...s, isOwner: false })),
    ];
  }
}
