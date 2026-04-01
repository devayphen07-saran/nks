import {
  TaxAgencyDto,
  TaxNameDto,
  CommodityCodeDto,
  CommodityCodeListDto,
  TaxRateMasterDto,
  TaxRateMasterListDto,
  TaxRegistrationDto,
  TaxRegistrationDetailDto,
} from '../dto';
import {
  TaxAgency,
  TaxName,
  CommodityCode,
  TaxRateMaster,
  TaxRegistration,
} from '../../../core/database/schema';

export class TaxMapper {
  // Tax Agency
  static toTaxAgencyDto(entity: TaxAgency): TaxAgencyDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      countryFk: entity.countryFk ?? undefined,
      description: entity.description ?? undefined,
      referenceUrl: entity.referenceUrl ?? undefined,
    };
  }

  static toTaxAgencyListDto(entities: TaxAgency[]): TaxAgencyDto[] {
    return entities.map((entity) => this.toTaxAgencyDto(entity));
  }

  // Tax Name
  static toTaxNameDto(entity: TaxName): TaxNameDto {
    return {
      id: entity.id,
      code: entity.code,
      taxName: entity.taxName,
      taxAgencyFk: entity.taxAgencyFk,
      description: entity.description ?? undefined,
    };
  }

  static toTaxNameListDto(entities: TaxName[]): TaxNameDto[] {
    return entities.map((entity) => this.toTaxNameDto(entity));
  }

  // Commodity Code
  static toCommodityCodeDto(entity: CommodityCode): CommodityCodeDto {
    return {
      id: entity.id,
      countryFk: entity.countryFk,
      code: entity.code,
      type: entity.type,
      digits: entity.digits as '4' | '6' | '8' | '10' | undefined,
      description: entity.description,
      displayName: entity.displayName ?? undefined,
      defaultTaxRate: entity.defaultTaxRate.toString(),
      isExempted: entity.isExempted,
    };
  }

  static toCommodityCodeListDto(
    entities: CommodityCode[],
  ): CommodityCodeListDto[] {
    return entities.map((entity) => ({
      id: entity.id,
      code: entity.code,
      type: entity.type,
      displayName: entity.displayName ?? undefined,
      defaultTaxRate: entity.defaultTaxRate.toString(),
    }));
  }

  // Tax Rate Master
  static toTaxRateMasterDto(entity: TaxRateMaster): TaxRateMasterDto {
    return {
      id: entity.id,
      countryFk: entity.countryFk,
      storeFk: entity.storeFk,
      commodityCodeFk: entity.commodityCodeFk,
      baseTaxRate: entity.baseTaxRate,
      component1Rate: entity.component1Rate ?? undefined,
      component2Rate: entity.component2Rate ?? undefined,
      component3Rate: entity.component3Rate ?? undefined,
      additionalRate: entity.additionalRate ?? undefined,
      effectiveFrom: entity.effectiveFrom,
      effectiveTo: entity.effectiveTo ?? undefined,
      isActive: entity.isActive,
    };
  }

  static toTaxRateMasterListDto(
    entities: TaxRateMaster[],
  ): TaxRateMasterListDto[] {
    return entities.map((entity) => ({
      id: entity.id,
      baseTaxRate: entity.baseTaxRate,
      component1Rate: entity.component1Rate ?? undefined,
      component2Rate: entity.component2Rate ?? undefined,
      component3Rate: entity.component3Rate ?? undefined,
      effectiveFrom: entity.effectiveFrom,
      effectiveTo: entity.effectiveTo ?? undefined,
      isActive: entity.isActive,
    }));
  }

  // Tax Registration
  static toTaxRegistrationDto(entity: TaxRegistration): TaxRegistrationDto {
    return {
      id: entity.id,
      storeFk: entity.storeFk,
      countryFk: entity.countryFk,
      taxAgencyFk: entity.taxAgencyFk,
      taxNameFk: entity.taxNameFk,
      registrationNumber: entity.registrationNumber,
      regionCode: entity.regionCode ?? undefined,
      registrationType: entity.registrationType,
      label: entity.label ?? undefined,
      filingFrequency: entity.filingFrequency,
      effectiveFrom: entity.effectiveFrom,
      effectiveTo: entity.effectiveTo ?? undefined,
    };
  }

  static toTaxRegistrationListDto(
    entities: TaxRegistration[],
  ): TaxRegistrationDto[] {
    return entities.map((entity) => this.toTaxRegistrationDto(entity));
  }

  static toTaxRegistrationDetailDto(
    entity: TaxRegistration,
    agencyName?: string,
    taxName?: string,
  ): TaxRegistrationDetailDto {
    return {
      id: entity.id,
      registrationNumber: entity.registrationNumber,
      registrationType: entity.registrationType,
      label: entity.label ?? undefined,
      filingFrequency: entity.filingFrequency,
      effectiveFrom: entity.effectiveFrom,
      effectiveTo: entity.effectiveTo ?? undefined,
      agencyName: agencyName ?? undefined,
      taxName: taxName ?? undefined,
    };
  }
}
