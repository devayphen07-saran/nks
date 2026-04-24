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
}
