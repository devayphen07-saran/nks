import type { AdminUserResponse, AdminStoreResponse } from '../admin.schemas';

interface UserData {
  id: number;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  emailVerified: boolean;
  phoneNumberVerified: boolean;
  isBlocked: boolean;
  loginCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StoreData {
  id: number;
  storeCode: string;
  storeName: string;
  storeLegalTypeFk: number;
  storeCategoryFk: number;
  registrationNumber: string | null;
  taxNumber: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AdminMapper {
  static toUserResponseDto(entity: UserData): AdminUserResponse {
    return {
      id: entity.id,
      name: entity.name,
      email: entity.email ?? null,
      phoneNumber: entity.phoneNumber ?? null,
      emailVerified: entity.emailVerified,
      phoneNumberVerified: entity.phoneNumberVerified,
      isBlocked: entity.isBlocked,
      loginCount: entity.loginCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toStoreResponseDto(entity: StoreData): AdminStoreResponse {
    return {
      id: entity.id,
      storeCode: entity.storeCode,
      storeName: entity.storeName,
      storeLegalTypeFk: entity.storeLegalTypeFk,
      storeCategoryFk: entity.storeCategoryFk,
      registrationNumber: entity.registrationNumber ?? null,
      taxNumber: entity.taxNumber ?? null,
      isDeleted: entity.isDeleted,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toUserResponseDtoArray(entities: UserData[]): AdminUserResponse[] {
    return entities.map((entity) => this.toUserResponseDto(entity));
  }

  static toStoreResponseDtoArray(entities: StoreData[]): AdminStoreResponse[] {
    return entities.map((entity) => this.toStoreResponseDto(entity));
  }
}
