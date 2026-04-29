import { Injectable } from '@nestjs/common';
import { NotFoundException, ForbiddenException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { StoresRepository } from './repositories/stores.repository';
export type { StoreDto } from './mapper/stores.mapper';

/**
 * StoresService
 *
 * Manages store-related operations (set default store for user).
 *
 * Authorization Contract:
 *   - setDefaultStore(userId, storeGuuid): No explicit permission checks needed.
 *     userId must be a member of the store (enforced via atomic EXISTS subquery in repository).
 *     Marked with @NoEntityPermissionRequired at controller level because membership
 *     is verified in the database transaction, not via permission ceiling checks.
 *
 * Business Rule Validation:
 *   - Store must exist (findByGuuid returns null if not found)
 *   - User must be a member of the store (setDefaultStoreIfMember checks membership atomically)
 *   - Only a member can set a store as their default
 *
 * Audit Trail:
 *   - userId parameter identifies whose default store is being set
 *   - Note: Audit logging not currently implemented for this operation (low-risk action)
 */
@Injectable()
export class StoresService {

  constructor(private readonly storesRepository: StoresRepository) {}

  async setDefaultStore(userId: number, storeGuuid: string): Promise<void> {
    const store = await this.storesRepository.findByGuuid(storeGuuid);
    if (!store) throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));

    const updated = await this.storesRepository.setDefaultStoreIfMember(userId, store.id);
    if (!updated) throw new ForbiddenException(errPayload(ErrorCode.FORBIDDEN));
  }
}
