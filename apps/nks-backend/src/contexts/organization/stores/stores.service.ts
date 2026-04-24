import { Injectable } from '@nestjs/common';
import { NotFoundException, ForbiddenException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { StoresRepository } from './repositories/stores.repository';
import { StoresMapper, type StoreDto } from './mapper/stores.mapper';
export type { StoreDto } from './mapper/stores.mapper';

@Injectable()
export class StoresService {
  constructor(
    private readonly storesRepository: StoresRepository,
  ) {}

  async getMyStores(userId: number): Promise<{ myStores: StoreDto[]; invitedStores: StoreDto[] }> {
    const rows = await this.storesRepository.getStoresForUser(userId);
    return {
      myStores: rows.filter((r) => r.isOwner).map(StoresMapper.buildStoreDto),
      invitedStores: rows.filter((r) => !r.isOwner).map(StoresMapper.buildStoreDto),
    };
  }

  /**
   * True iff the store row exists, is active, and not soft-deleted.
   *
   * Called by RBACGuard on every request that carries an `activeStoreId`,
   * so it must stay a single indexed PK lookup. Do NOT cache the result
   * in-process — cache entries in multi-pod deployments silently diverge
   * from the DB when a store is deactivated.
   */
  async isActive(storeId: number): Promise<boolean> {
    const row = await this.storesRepository.findActiveById(storeId);
    return row !== null;
  }

  async setDefaultStore(userId: number, storeGuuid: string): Promise<void> {
    const store = await this.storesRepository.findByGuuid(storeGuuid);
    if (!store) throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));

    // Atomic: membership check + UPDATE in a single SQL statement.
    // Eliminates the TOCTOU window from the old getStoresForUser + setDefaultStore 2-step.
    const updated = await this.storesRepository.setDefaultStoreIfMember(userId, store.id);
    if (!updated) throw new ForbiddenException(errPayload(ErrorCode.FORBIDDEN));
  }
}
