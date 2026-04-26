import { Injectable } from '@nestjs/common';
import { StoresRepository } from './repositories/stores.repository';

/**
 * StoreQueryService — narrow read surface for cross-context consumers.
 *
 * Guards in common/guards/ must not import the full StoresService (domain service
 * with write operations and business logic). This service exposes only the
 * read-only predicates that infrastructure-level code actually needs.
 *
 * Mutation flows remain in StoresService. RBACGuard injects this service so
 * it can verify store-active state without taking a dependency on the full
 * stores domain.
 */
@Injectable()
export class StoreQueryService {
  constructor(private readonly storesRepository: StoresRepository) {}

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
