import type {
  UserStoreRow,
  RecordAddress,
} from '../repositories/stores.repository';

export interface StoreDto {
  /** Internal numeric id — used by mobile as local SQLite primary key. */
  id: number;
  guuid: string;
  storeName: string;
  storeCode: string | null;
  isApproved: boolean;
  isDefault: boolean;
  isOwner: boolean;
  timezone: string;
  /** Comma-joined `line1, line2, city` from the default address. null when not set. */
  address: string | null;
  /** Phone number from the primary communication row. null when not set. */
  phone: string | null;
  createdAt: string;
}

/** Inputs passed in by the service. Address/phone come from the polymorphic tables. */
export interface BuildStoreDtoInput {
  row: UserStoreRow;
  address: RecordAddress | null;
  phone: string | null;
}

export class StoresMapper {
  static buildStoreDto(input: BuildStoreDtoInput): StoreDto {
    const { row, address, phone } = input;
    return {
      id:         row.id,
      guuid:      row.guuid,
      storeName:  row.storeName,
      storeCode:  row.storeCode,
      isApproved: row.storeStatus === 'ACTIVE' && row.isVerified,
      isDefault:  row.isDefault,
      isOwner:    row.isOwner,
      timezone:   row.timezone,
      address:    StoresMapper.formatAddress(address),
      phone:      phone,
      createdAt:  row.createdAt.toISOString(),
    };
  }

  private static formatAddress(address: RecordAddress | null): string | null {
    if (!address) return null;
    const parts = [address.line1, address.line2, address.cityName]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .map((p) => p.trim());
    return parts.length > 0 ? parts.join(', ') : null;
  }
}
