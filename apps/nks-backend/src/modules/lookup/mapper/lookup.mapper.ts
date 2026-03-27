import {
  StoreLegalTypeResponseDto,
  SalutationResponseDto,
  DialCodeResponseDto,
  DesignationResponseDto,
} from '../dto/lookup-response.dto';
import type {
  StoreLegalType,
  Salutation,
  Designation,
} from '../../../core/database/schema';

// Shape returned by LookupRepository.findAllDialCodes()
type DialCodeRow = {
  id: number;
  countryName: string;
  countryCode: string | null;
  dialCode: string | null;
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
      countryCode: entity.countryCode ?? '',
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
}
