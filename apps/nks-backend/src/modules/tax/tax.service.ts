import { Injectable } from '@nestjs/common';
import { TaxRepository } from './tax.repository';
import { TaxMapper } from './mapper/tax.mapper';
import { CreateTaxRegistrationDto } from './dto';
import { BadRequestException } from '../../common/exceptions';
import { ErrorCode } from '../../common/constants/error-codes.constants';

/**
 * Tax Service
 *
 * Handles tax-related business logic:
 * - Tax agency and name lookups
 * - Commodity code classification (HSN, SAC, HS, CN, UNSPSC)
 * - Tax rate determination for transactions (effective date based)
 * - Tax registration management (multi-country support)
 * - Daily tax summary aggregation
 * - Transaction tax line recording
 *
 * All queries are country-scoped to ensure multi-country compliance.
 */
@Injectable()
export class TaxService {
  constructor(private readonly taxRepository: TaxRepository) {}

  /**
   * Get tax agency by code
   */
  async getTaxAgency(code: string) {
    const agency = await this.taxRepository.findAgencyByCode(code);

    if (!agency) {
      throw new BadRequestException({
        errorCode: ErrorCode.TAX_AGENCY_NOT_FOUND,
        message: `Tax agency ${code} not found`,
      });
    }

    return TaxMapper.toTaxAgencyDto(agency);
  }

  /**
   * Get all tax agencies for a country
   */
  async getTaxAgenciesByCountry(countryId: number) {
    const agencies = await this.taxRepository.findAgenciesByCountry(countryId);
    return TaxMapper.toTaxAgencyListDto(agencies);
  }

  /**
   * Get tax name by code
   */
  async getTaxName(code: string) {
    const taxName = await this.taxRepository.findTaxNameByCode(code);

    if (!taxName) {
      throw new BadRequestException({
        errorCode: ErrorCode.TAX_NAME_NOT_FOUND,
        message: `Tax type ${code} not found`,
      });
    }

    return TaxMapper.toTaxNameDto(taxName);
  }

  /**
   * Get all tax names for an agency
   */
  async getTaxNamesByAgency(agencyId: number) {
    const taxNames = await this.taxRepository.findTaxNamesByAgency(agencyId);
    return TaxMapper.toTaxNameListDto(taxNames);
  }

  /**
   * Get commodity code by code and type
   * Supports: HSN (India goods), SAC (India services), HS (international),
   * CN (EU), UNSPSC (universal product classification)
   */
  async getCommodityCode(
    countryId: number,
    code: string,
    type: 'HSN' | 'SAC' | 'HS' | 'CN' | 'UNSPSC',
  ) {
    const commodity = await this.taxRepository.findCommodityCode(
      countryId,
      code,
      type,
    );

    if (!commodity) {
      throw new BadRequestException({
        errorCode: ErrorCode.COMMODITY_CODE_NOT_FOUND,
        message: `Commodity code ${code} (type: ${type}) not found for this country`,
      });
    }

    return TaxMapper.toCommodityCodeDto(commodity);
  }

  /**
   * Get all commodity codes for a country
   */
  async getCommodityCodesByCountry(countryId: number) {
    const commodities =
      await this.taxRepository.findCommodityCodesByCountry(countryId);
    return TaxMapper.toCommodityCodeListDto(commodities);
  }

  /**
   * Get applicable tax rate for a store and commodity on a given date
   *
   * Returns the most recent tax rate that is:
   * - Assigned to the store
   * - Applicable to the commodity code
   * - Effective on the transaction date (effective_from <= date <= effective_to)
   *
   * Used during transaction processing to determine tax components (CGST/SGST for India, etc.)
   */
  async getApplicableTaxRate(
    storeId: number,
    commodityCodeId: number,
    transactionDate: string,
  ) {
    const rate = await this.taxRepository.findApplicableTaxRate(
      storeId,
      commodityCodeId,
      transactionDate,
    );

    if (!rate) {
      throw new BadRequestException({
        errorCode: ErrorCode.TAX_RATE_NOT_FOUND,
        message: `No applicable tax rate found for this commodity on ${transactionDate}`,
      });
    }

    return TaxMapper.toTaxRateMasterDto(rate);
  }

  /**
   * Get all tax rates for a store
   */
  async getTaxRatesByStore(storeId: number) {
    const rates = await this.taxRepository.findTaxRatesByStore(storeId);
    return TaxMapper.toTaxRateMasterListDto(rates);
  }

  /**
   * Register a tax for a store
   *
   * Creates a new tax_registrations record linking:
   * - Store + Country + Tax Agency + Tax Name
   * - Registration number (GSTIN, VAT number, etc.)
   * - Region code (for intra/inter-state distinction)
   * - Filing frequency and registration type
   */
  async registerTax(userId: number, dto: CreateTaxRegistrationDto) {
    // Check for duplicate registration number in country
    const existingReg = await this.taxRepository.findTaxRegistrationByNumber(
      dto.countryFk,
      dto.registrationNumber,
    );

    if (existingReg) {
      throw new BadRequestException({
        errorCode: ErrorCode.TAX_REGISTRATION_EXISTS,
        message: `Registration number ${dto.registrationNumber} already exists for this country`,
      });
    }

    // Create registration
    const registration = await this.taxRepository.createTaxRegistration({
      storeFk: dto.storeFk,
      countryFk: dto.countryFk,
      taxAgencyFk: dto.taxAgencyFk,
      taxNameFk: dto.taxNameFk,
      registrationNumber: dto.registrationNumber,
      regionCode: dto.regionCode,
      registrationType: dto.registrationType ?? 'REGULAR',
      label: dto.label,
      filingFrequency: dto.filingFrequency ?? 'MONTHLY',
      effectiveFrom: dto.effectiveFrom,
      effectiveTo: dto.effectiveTo,
      createdBy: userId,
      modifiedBy: userId,
    });

    return TaxMapper.toTaxRegistrationDetailDto(registration);
  }

  /**
   * Get all active tax registrations for a store
   */
  async getTaxRegistrationsByStore(storeId: number) {
    const registrations =
      await this.taxRepository.findTaxRegistrationsByStore(storeId);
    return TaxMapper.toTaxRegistrationListDto(registrations);
  }

  /**
   * Get daily tax summary for a store
   *
   * Returns aggregated tax liability for a specific date, broken down by tax rate.
   * Used for:
   * - Tax return filing (GSTR, VAT returns, etc.)
   * - Dashboard reporting
   * - Audit trail
   */
  async getDailyTaxSummary(
    storeId: number,
    countryId: number,
    transactionDate: string,
  ) {
    return this.taxRepository.findDailyTaxSummary(
      storeId,
      countryId,
      transactionDate,
    );
  }
}
