import { Injectable, Logger } from '@nestjs/common';
import { StoresRepository } from './repositories/stores.repository';
import {
  StoresMapper,
  type StoreDto,
  type BuildStoreDtoInput,
} from './mapper/stores.mapper';
import { EntityRegistryService } from '../../reference-data/entities';
import { EntityNames } from '../../../common/constants/entity-names.constants';

/**
 * StoreQueryService — read-only surface for stores.
 *
 * Guards (RBACGuard) and the StoresController both use this service for all
 * read operations. Write operations (setDefaultStore) live in StoresService.
 */
@Injectable()
export class StoreQueryService {
  private readonly logger = new Logger(StoreQueryService.name);

  constructor(
    private readonly storesRepository: StoresRepository,
    private readonly entityRegistry: EntityRegistryService,
  ) {}

  async getMyStores(
    userId: number,
  ): Promise<{ myStores: StoreDto[]; invitedStores: StoreDto[] }> {
    const rows = await this.storesRepository.getStoresForUser(userId);
    if (rows.length === 0) {
      return { myStores: [], invitedStores: [] };
    }

    // Resolve `entity.id` for the polymorphic owner type once per call.
    // The id is cached in EntityRegistryService — no DB hit on the hot path.
    const storeEntityId = this.entityRegistry.getIdOrThrow(EntityNames.STORE);
    const storeIds = rows.map((r) => r.id);

    // Two batched queries — one for phone, one for address — across all stores.
    // Avoids N+1 from looping per store.
    const [phones, addresses] = await Promise.all([
      this.storesRepository.getPrimaryPhonesForRecords(storeEntityId, storeIds),
      this.storesRepository.getPrimaryAddressesForRecords(storeEntityId, storeIds),
    ]);

    const phoneByStoreId = new Map(
      phones.map((p) => [p.recordId, p.phoneNumber]),
    );
    const addressByStoreId = new Map(addresses.map((a) => [a.recordId, a]));

    const dtos = rows.map<StoreDto>((row) => {
      const input: BuildStoreDtoInput = {
        row,
        address: addressByStoreId.get(row.id) ?? null,
        phone:   phoneByStoreId.get(row.id) ?? null,
      };
      return StoresMapper.buildStoreDto(input);
    });

    return {
      myStores:      dtos.filter((d) => d.isOwner),
      invitedStores: dtos.filter((d) => !d.isOwner),
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
   * Resolve a single store by guuid for a given user, batching the primary
   * phone + address lookups. Returns null if the store doesn't exist or the
   * user is not a member — callers MUST treat both cases identically (a
   * 404 vs 403 leak would let a caller probe ids across tenants).
   *
   * Exposed so cross-context consumers (e.g. iam/roles StoreConfigService)
   * can read store context without reaching into StoresRepository directly.
   */
  async getStoreContextForUser(
    userId: number,
    storeGuuid: string,
  ): Promise<{
    row: {
      id: number;
      guuid: string;
      storeName: string;
      timezone: string;
      isDefault: boolean;
    };
    phone: string | null;
    address: { line1: string | null; line2: string | null; cityName: string | null } | null;
  } | null> {
    const rows = await this.storesRepository.getStoresForUser(userId);
    const row = rows.find((r) => r.guuid === storeGuuid);
    if (!row) return null;

    const storeEntityId = this.entityRegistry.getIdOrThrow(EntityNames.STORE);
    const [phones, addresses] = await Promise.all([
      this.storesRepository.getPrimaryPhonesForRecords(storeEntityId, [row.id]),
      this.storesRepository.getPrimaryAddressesForRecords(storeEntityId, [row.id]),
    ]);

    return {
      row: {
        id:        row.id,
        guuid:     row.guuid,
        storeName: row.storeName,
        timezone:  row.timezone,
        isDefault: row.isDefault,
      },
      phone:   phones[0]?.phoneNumber ?? null,
      address: addresses[0] ?? null,
    };
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
