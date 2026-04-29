import { Injectable } from '@nestjs/common';
import { StoresRepository } from './repositories/stores.repository';
import { StoresMapper, type StoreDto } from './mapper/stores.mapper';

/**
 * StoreQueryService — read-only surface for stores.
 *
 * Guards (RBACGuard) and the StoresController both use this service for all
 * read operations. Write operations (setDefaultStore) live in StoresService.
 */
@Injectable()
export class StoreQueryService {
  constructor(private readonly storesRepository: StoresRepository) {}

  async getMyStores(userId: number): Promise<{ myStores: StoreDto[]; invitedStores: StoreDto[] }> {
    const rows = await this.storesRepository.getStoresForUser(userId);
    return {
      myStores: rows.filter((r) => r.isOwner).map(StoresMapper.buildStoreDto),
      invitedStores: rows.filter((r) => !r.isOwner).map(StoresMapper.buildStoreDto),
    };
  }

  /**
   * True iff the store exists, is active, and is not soft-deleted.
   * Called by RBACGuard on every STORE-scoped request — must stay a single
   * indexed PK lookup. Do NOT cache in-process.
   */
  isActive(storeId: number): Promise<boolean> {
    return this.storesRepository
      .findActiveById(storeId)
      .then((row) => row !== null);
  }

  /**
   * True iff the user is the ownerUserFk of the given active store.
   * Used by RBACGuard to bypass role-row membership check for store owners.
   */
  isStoreOwner(userId: number, storeId: number): Promise<boolean> {
    return this.storesRepository.isOwner(userId, storeId);
  }

  /**
   * Single-query active + ownership check.
   * Returns null if the store is not found, inactive, or soft-deleted.
   * Returns { isOwner } if the store is active — isOwner is true iff the
   * user is the store's ownerUserFk.
   *
   * Use this instead of isActive() + isStoreOwner() to eliminate the TOCTOU
   * window where the store could be deactivated between the two separate queries.
   */
  findActiveWithOwnership(
    userId: number,
    storeId: number,
  ): Promise<{ isOwner: boolean } | null> {
    return this.storesRepository.findActiveWithOwnership(userId, storeId);
  }
}
