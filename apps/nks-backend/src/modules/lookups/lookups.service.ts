import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { LookupsRepository } from './repositories/lookups.repository';
import {
  toSalutationResponse,
  toAddressTypeResponse,
  toDesignationResponse,
  toStoreLegalTypeResponse,
  toStoreCategoryResponse,
  toCountryResponse,
  toCommunicationTypeResponse,
  toCurrencyResponse,
  toVolumeResponse,
} from './mapper/lookups.mapper';
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
    return this.getLookups(() => this.repository.getSalutations(), toSalutationResponse);
  }

  async getAddressTypes(): Promise<AddressTypesListResponse> {
    return this.getLookups(() => this.repository.getAddressTypes(), toAddressTypeResponse);
  }

  async getDesignations(): Promise<DesignationsListResponse> {
    return this.getLookups(() => this.repository.getDesignations(), toDesignationResponse);
  }

  async getStoreLegalTypes(): Promise<StoreLegalTypesListResponse> {
    return this.getLookups(() => this.repository.getStoreLegalTypes(), toStoreLegalTypeResponse);
  }

  async getStoreCategories(): Promise<StoreCategoriesListResponse> {
    return this.getLookups(() => this.repository.getStoreCategories(), toStoreCategoryResponse);
  }

  async getCountries(): Promise<CountriesListResponse> {
    return this.getLookups(() => this.repository.getCountries(), toCountryResponse);
  }

  async getCommunicationTypes(): Promise<CommunicationTypesListResponse> {
    return this.getLookups(() => this.repository.getCommunicationTypes(), toCommunicationTypeResponse);
  }

  async getCurrencies(): Promise<CurrenciesListResponse> {
    return this.getLookups(() => this.repository.getCurrencies(), toCurrencyResponse);
  }

  async getVolumes(): Promise<VolumesListResponse> {
    return this.getLookups(() => this.repository.getVolumes(), toVolumeResponse);
  }

  // ── Public: specialized lookups (not tied to code-value tables) ──────────

  // ── Admin: Generic code-value lookups ───────────────────────────────────

  /**
   * Get all custom lookup types (categories).
   */
  async getAllLookupTypes(): Promise<LookupTypesListResponse> {
    return this.repository.findAllCodeCategories();
  }

  /**
   * Get all lookup values for a specific category code.
   */
  async getLookupValues(
    categoryCode: string,
  ): Promise<LookupValuesListResponse> {
    return this.repository.findCodeValuesByCategory(categoryCode);
  }

  /**
   * Create a new lookup value in a specific category.
   */
  async createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
  ): Promise<LookupValueAdminResponse> {
    const category = await this.repository.findCodeCategoryByCode(categoryCode);
    if (!category) {
      throw new NotFoundException(`Category '${categoryCode}' not found`);
    }
    return this.repository.createCodeValue(category.id, dto);
  }

  /**
   * Update an existing lookup value, enforcing it belongs to the given category.
   * Uses a single JOIN query instead of two sequential round-trips.
   */
  async updateLookupValue(
    categoryCode: string,
    id: number,
    dto: UpdateLookupValueDto,
  ): Promise<LookupValueAdminResponse> {
    const value = await this.repository.findCodeValueByIdAndCategory(id, categoryCode);
    if (!value) {
      throw new NotFoundException(
        `Lookup value with ID ${id} not found in category '${categoryCode}'`,
      );
    }
    const updated = await this.repository.updateCodeValue(id, dto);
    if (!updated) {
      throw new BadRequestException(`Failed to update lookup value ${id}`);
    }
    return updated;
  }

  /**
   * Delete a lookup value, enforcing it belongs to the given category.
   * Uses a single JOIN query instead of two sequential round-trips.
   */
  async deleteLookupValue(categoryCode: string, id: number): Promise<void> {
    const value = await this.repository.findCodeValueByIdAndCategory(id, categoryCode);
    if (!value) {
      throw new NotFoundException(
        `Lookup value with ID ${id} not found in category '${categoryCode}'`,
      );
    }
    await this.repository.deleteCodeValue(id);
  }
}
