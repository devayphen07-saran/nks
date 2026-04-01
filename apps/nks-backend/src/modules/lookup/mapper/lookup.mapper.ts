import {
  StoreLegalTypeResponseDto,
  SalutationResponseDto,
  DialCodeResponseDto,
  DesignationResponseDto,
  StoreCategoryResponseDto,
  ConfigResponseDto,
} from '../dto/lookup-response.dto';
import type {
  StoreLegalType,
  Salutation,
  Designation,
  StoreCategory,
} from '../../../core/database/schema';

// Shape returned by LookupRepository.findAllDialCodes()
type DialCodeRow = {
  id: number;
  countryName: string;
  isoCode2: string;
  dialCode: string | null;
  currencyCode: string | null;
  currencySymbol: string | null;
  timezone: string | null;
  isActive: boolean;
};

export class LookupMapper {
  static toStoreLegalTypeResponseDto(
    entity: StoreLegalType,
  ): StoreLegalTypeResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      code: entity.legalTypeCode,
      name: entity.legalTypeName,
      description: entity.description ?? null,
      sortOrder: entity.sortOrder ?? null,
    };
  }

  // Note: Salutation has no dedicated code column — salutationText is used as the code.
  static toSalutationResponseDto(entity: Salutation): SalutationResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      code: entity.salutationText,
      name: entity.salutationText,
      description: entity.description ?? null,
      sortOrder: entity.sortOrder ?? null,
    };
  }

  static toDialCodeResponseDto(entity: DialCodeRow): DialCodeResponseDto {
    return {
      id: entity.id,
      countryName: entity.countryName,
      countryCode: entity.isoCode2,
      dialCode: entity.dialCode ?? '',
    };
  }

  static toDesignationResponseDto(entity: Designation): DesignationResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      code: entity.designationCode,
      name: entity.designationName,
      description: null, // designation table has no description column
      sortOrder: entity.sortOrder ?? null,
    };
  }

  static toStoreCategoryResponseDto(
    entity: StoreCategory,
  ): StoreCategoryResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      code: entity.categoryCode,
      name: entity.categoryName,
      description: entity.description ?? null,
      sortOrder: entity.sortOrder ?? null,
    };
  }

  static toConfigResponseDto(data: {
    storeCategories: StoreCategory[];
    storeLegalTypes: StoreLegalType[];
    salutations: Salutation[];
    designations: Designation[];
  }): ConfigResponseDto {
    return {
      storeCategories: data.storeCategories.map((d) =>
        this.toStoreCategoryResponseDto(d),
      ),
      storeLegalTypes: data.storeLegalTypes.map((d) =>
        this.toStoreLegalTypeResponseDto(d),
      ),
      salutations: data.salutations.map((d) => this.toSalutationResponseDto(d)),
      designations: data.designations.map((d) =>
        this.toDesignationResponseDto(d),
      ),
    };
  }
}
