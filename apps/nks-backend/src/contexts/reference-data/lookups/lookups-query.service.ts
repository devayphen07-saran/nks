import { Injectable } from '@nestjs/common';
import { NotFoundException } from '../../../common/exceptions';
import { LookupsRepository } from './repositories/lookups.repository';
import { CodeValueMapper, LookupMapper, AdminLookupMapper } from './mapper/lookups.mapper';
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
  LookupTypesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';

@Injectable()
export class LookupsQueryService {
  constructor(private readonly repository: LookupsRepository) {}

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
}
