import type { UserStoreRow } from '../repositories/stores.repository';

export interface StoreDto {
  guuid: string;
  storeName: string;
  storeCode: string | null;
  isApproved: boolean;
  isOwner: boolean;
  createdAt: string;
}

export class StoresMapper {
  static buildStoreDto(userStoreRow: UserStoreRow): StoreDto {
    return {
      guuid: userStoreRow.guuid,
      storeName: userStoreRow.storeName,
      storeCode: userStoreRow.storeCode,
      isApproved: userStoreRow.storeStatus === 'ACTIVE' && userStoreRow.isVerified,
      isOwner: userStoreRow.isOwner,
      createdAt: userStoreRow.createdAt.toISOString(),
    };
  }
}
