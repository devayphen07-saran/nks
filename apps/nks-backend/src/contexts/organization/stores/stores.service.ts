import { Injectable, Logger } from '@nestjs/common';
import { NotFoundException, ForbiddenException } from '../../../common/exceptions';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { StoresRepository } from './repositories/stores.repository';
export type { StoreDto } from './mapper/stores.mapper';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(private readonly storesRepository: StoresRepository) {}

  async setDefaultStore(userId: number, storeGuuid: string): Promise<void> {
    const store = await this.storesRepository.findByGuuid(storeGuuid);
    if (!store) throw new NotFoundException(errPayload(ErrorCode.STORE_NOT_FOUND));

    const updated = await this.storesRepository.setDefaultStoreIfMember(userId, store.id);
    if (!updated) throw new ForbiddenException(errPayload(ErrorCode.FORBIDDEN));
  }
}
