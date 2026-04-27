import { Injectable } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import { CodeValueMapper, LookupMapper, AdminLookupMapper } from './mapper/lookups.mapper';
import { AuditService } from '../../compliance/audit/audit.service';
import { ErrorCode, errPayload } from '../../../common/constants/error-codes.constants';
import { paginated } from '../../../common/utils/paginated-result';
import type { PaginatedResult } from '../../../common/utils/paginated-result';
import type {
  CodeValueResponse,
  CountryResponse,
  CommunicationTypeResponse,
  CurrencyResponse,
  VolumeResponse,
  PublicLookupItem,
} from './dto/lookups-response.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  LookupTypesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';

@Injectable()
export class LookupsService {
  constructor(
    private readonly repository: LookupsRepository,
    private readonly auditService: AuditService,
  ) {}

  async getSalutations(): Promise<CodeValueResponse[]> {
    return (await this.repository.getValuesByCategory('SALUTATION')).map(CodeValueMapper.buildCodeValueDto);
  }

  async getAddressTypes(): Promise<CodeValueResponse[]> {
    return (await this.repository.getValuesByCategory('ADDRESS_TYPE')).map(CodeValueMapper.buildCodeValueDto);
  }

  async getDesignations(): Promise<CodeValueResponse[]> {
    return (await this.repository.getValuesByCategory('DESIGNATION')).map(CodeValueMapper.buildCodeValueDto);
  }

  async getStoreLegalTypes(): Promise<CodeValueResponse[]> {
    return (await this.repository.getValuesByCategory('STORE_LEGAL_TYPE')).map(CodeValueMapper.buildCodeValueDto);
  }

  async getStoreCategories(): Promise<CodeValueResponse[]> {
    return (await this.repository.getValuesByCategory('STORE_CATEGORY')).map(CodeValueMapper.buildCodeValueDto);
  }

  async getCountries(): Promise<CountryResponse[]> {
    return (await this.repository.getCountries()).map(LookupMapper.buildCountryDto);
  }

  async getCommunicationTypes(): Promise<CommunicationTypeResponse[]> {
    return (await this.repository.getCommunicationTypes()).map(LookupMapper.buildCommunicationTypeDto);
  }

  async getCurrencies(): Promise<CurrencyResponse[]> {
    return (await this.repository.getCurrencies()).map(LookupMapper.buildCurrencyDto);
  }

  async getVolumes(): Promise<VolumeResponse[]> {
    return (await this.repository.getVolumes()).map(LookupMapper.buildVolumeDto);
  }

  async getPublicLookup(slug: string): Promise<PublicLookupItem[]> {
    switch (slug) {
      case 'salutations':         return this.getSalutations();
      case 'countries':           return this.getCountries();
      case 'address-types':       return this.getAddressTypes();
      case 'communication-types': return this.getCommunicationTypes();
      case 'designations':        return this.getDesignations();
      case 'store-legal-types':   return this.getStoreLegalTypes();
      case 'store-categories':    return this.getStoreCategories();
      case 'currencies':          return this.getCurrencies();
      case 'volumes':             return this.getVolumes();
      default:
        throw new NotFoundException(errPayload(ErrorCode.LOOKUP_NOT_FOUND));
    }
  }

  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.repository.findAllCodeCategories();
  }

  async listLookupValues(
    categoryCode: string,
    opts: { page: number; pageSize: number; search?: string; sortBy?: string; sortOrder?: string; isActive?: boolean },
  ): Promise<PaginatedResult<LookupValueAdminResponse>> {
    const { rows, total } = await this.repository.findCodeValuesByCategory(categoryCode, opts);
    return paginated({ items: rows.map(AdminLookupMapper.buildLookupValueDto), page: opts.page, pageSize: opts.pageSize, total });
  }

  async createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const category = await this.repository.findCodeCategoryByCode(categoryCode);
    if (!category) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_CATEGORY_NOT_FOUND));
    const result = await this.repository.createCodeValue(category.id, dto);
    this.auditService.logLookupValueCreated(userId, result.id, categoryCode);
    return result;
  }

  async updateLookupValue(
    categoryCode: string,
    guuid: string,
    dto: UpdateLookupValueDto,
    userId: number,
  ): Promise<LookupValueAdminResponse> {
    const value = await this.repository.findCodeValueByGuuidAndCategory(guuid, categoryCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    const updated = await this.repository.updateCodeValue(value.numericId, dto);
    if (!updated) throw new BadRequestException(errPayload(ErrorCode.LOOKUP_UPDATE_FAILED));
    this.auditService.logLookupValueUpdated(userId, value.numericId, categoryCode);
    return updated;
  }

  async deleteLookupValue(categoryCode: string, guuid: string, userId: number): Promise<void> {
    const value = await this.repository.findCodeValueByGuuidAndCategory(guuid, categoryCode);
    if (!value) throw new NotFoundException(errPayload(ErrorCode.LOOKUP_VALUE_NOT_FOUND));
    await this.repository.deleteCodeValue(value.numericId);
    this.auditService.logLookupValueDeleted(userId, value.numericId, categoryCode);
  }
}
