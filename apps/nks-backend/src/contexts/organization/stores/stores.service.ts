import { Injectable } from '@nestjs/common';
import { StoresRepository } from './repositories/stores.repository';

export interface StoreDto {
  id: number;
  guuid: string;
  storeName: string;
  storeCode: string | null;
  isApproved: boolean;
  isOwner: boolean;
  createdAt: string;
}

@Injectable()
export class StoresService {
  constructor(private readonly storesRepository: StoresRepository) {}

  async getMyStores(userId: number): Promise<{
    myStores: StoreDto[];
    invitedStores: StoreDto[];
  }> {
    const rows = await this.storesRepository.getStoresForUser(userId);

    const toDto = (row: (typeof rows)[0]): StoreDto => ({
      id: row.id,
      guuid: row.guuid,
      storeName: row.storeName,
      storeCode: row.storeCode,
      isApproved: row.storeStatus === 'ACTIVE' && row.isVerified,
      isOwner: row.isOwner,
      createdAt: row.createdAt.toISOString(),
    });

    return {
      myStores: rows.filter((r) => r.isOwner).map(toDto),
      invitedStores: rows.filter((r) => !r.isOwner).map(toDto),
    };
  }
}
