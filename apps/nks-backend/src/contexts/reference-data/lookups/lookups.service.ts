import { Injectable } from '@nestjs/common';
import { LookupsRepository } from './repositories/lookups.repository';
import { LookupsValidator } from './validators';
import { CodeValueMapper, LookupMapper } from './mapper/lookups.mapper';
import type {
  SalutationsListResponse,
  CountriesListResponse,
  AddressTypesListResponse,
  CommunicationTypesListResponse,
  DesignationsListResponse,
  StoreLegalTypesListResponse,
  StoreCategoriesListResponse,
  CurrenciesListResponse,
  VolumesListResponse,
} from './dto/lookups-response.dto';
import type {
  CreateLookupValueDto,
  UpdateLookupValueDto,
  LookupTypesListResponse,
  LookupValuesListResponse,
  LookupValueAdminResponse,
} from './dto/admin-lookups.dto';

@Injectable()
export class LookupsService {
  constructor(private readonly repository: LookupsRepository) {}

  // ── Private helper ───────────────────────────────────────────────────────

  private async getLookups<T, R>(
    fetch: () => Promise<T[]>,
    map: (item: T) => R,
  ): Promise<R[]> {
    const rows = await fetch();
    return rows.map(map);
  }

  // ── Public: code-value family (salutations, address types, …) ────────────

  async getSalutations(): Promise<SalutationsListResponse> {
    return this.getLookups(() => this.repository.getSalutations(), CodeValueMapper.toSalutation);
  }

  async getAddressTypes(): Promise<AddressTypesListResponse> {
    return this.getLookups(() => this.repository.getAddressTypes(), CodeValueMapper.toAddressType);
  }

  async getDesignations(): Promise<DesignationsListResponse> {
    return this.getLookups(() => this.repository.getDesignations(), CodeValueMapper.toDesignation);
  }

  async getStoreLegalTypes(): Promise<StoreLegalTypesListResponse> {
    return this.getLookups(() => this.repository.getStoreLegalTypes(), CodeValueMapper.toStoreLegalType);
  }

  async getStoreCategories(): Promise<StoreCategoriesListResponse> {
    return this.getLookups(() => this.repository.getStoreCategories(), CodeValueMapper.toStoreCategory);
  }

  async getCountries(): Promise<CountriesListResponse> {
    return this.getLookups(() => this.repository.getCountries(), LookupMapper.toCountry);
  }

  async getCommunicationTypes(): Promise<CommunicationTypesListResponse> {
    return this.getLookups(() => this.repository.getCommunicationTypes(), LookupMapper.toCommunicationType);
  }

  async getCurrencies(): Promise<CurrenciesListResponse> {
    return this.getLookups(() => this.repository.getCurrencies(), LookupMapper.toCurrency);
  }

  async getVolumes(): Promise<VolumesListResponse> {
    return this.getLookups(() => this.repository.getVolumes(), LookupMapper.toVolume);
  }

  // ── Public: single generic dispatch ─────────────────────────────────────

  private static readonly LOOKUP_HANDLERS: Record<string, (svc: LookupsService) => Promise<unknown[]>> = {
    'salutations':         (s) => s.getSalutations(),
    'countries':           (s) => s.getCountries(),
    'address-types':       (s) => s.getAddressTypes(),
    'communication-types': (s) => s.getCommunicationTypes(),
    'designations':        (s) => s.getDesignations(),
    'store-legal-types':   (s) => s.getStoreLegalTypes(),
    'store-categories':    (s) => s.getStoreCategories(),
    'currencies':          (s) => s.getCurrencies(),
    'volumes':             (s) => s.getVolumes(),
  };

  /**
   * Whitelist-guarded dispatcher for `GET /lookups/:code`.
   * Only slugs present in LOOKUP_HANDLERS are accessible — all others 404.
   */
  async getPublicLookup(slug: string): Promise<unknown[]> {
    const handler = LookupsService.LOOKUP_HANDLERS[slug];
    LookupsValidator.assertLookupExists(handler);
    return handler(this);
  }

  // ── Admin: Generic code-value lookups ───────────────────────────────────

  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.repository.findAllCodeCategories();
  }

  async listLookupValues(
    categoryCode: string,
    opts: { page: number; pageSize: number; search?: string },
  ): Promise<{ rows: LookupValuesListResponse; total: number }> {
    const { rows, total } = await this.repository.findCodeValuesByCategory(categoryCode, opts);
    return { rows, total };
  }

  async createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
  ): Promise<LookupValueAdminResponse> {
    const category = await this.repository.findCodeCategoryByCode(categoryCode);
    LookupsValidator.assertCategoryFound(category);
    return this.repository.createCodeValue(category.id, dto);
  }

  async updateLookupValue(
    categoryCode: string,
    id: number,
    dto: UpdateLookupValueDto,
  ): Promise<LookupValueAdminResponse> {
    const value = await this.repository.findCodeValueByIdAndCategory(id, categoryCode);
    LookupsValidator.assertValueFound(value);
    const updated = await this.repository.updateCodeValue(id, dto);
    LookupsValidator.assertUpdateSucceeded(updated);
    return updated;
  }

  async deleteLookupValue(categoryCode: string, id: number): Promise<void> {
    const value = await this.repository.findCodeValueByIdAndCategory(id, categoryCode);
    LookupsValidator.assertValueFound(value);
    await this.repository.deleteCodeValue(id);
  }
}
