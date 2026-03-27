import { StoreRegisterResponseDto } from '../dto/store-response.dto';

type StoreRegisterResult = {
  storeId: number;
  storeCode: string | null;
  role: string;
};

export class StoreMapper {
  static toRegisterResponseDto(
    entity: StoreRegisterResult,
  ): StoreRegisterResponseDto {
    return {
      storeId: entity.storeId,
      storeCode: entity.storeCode ?? '',
      role: entity.role,
    };
  }
}
