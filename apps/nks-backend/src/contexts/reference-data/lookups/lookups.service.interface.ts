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

/**
 * ILookupsService — explicit contract for lookup reference data.
 *
 * Usage in tests:
 *   const mockLookups: ILookupsService = { getSalutations: jest.fn(), ... };
 *   providers: [{ provide: LookupsService, useValue: mockLookups }]
 */
export interface ILookupsService {
  getSalutations(): Promise<SalutationsListResponse>;
  getAddressTypes(): Promise<AddressTypesListResponse>;
  getDesignations(): Promise<DesignationsListResponse>;
  getStoreLegalTypes(): Promise<StoreLegalTypesListResponse>;
  getStoreCategories(): Promise<StoreCategoriesListResponse>;
  getCountries(): Promise<CountriesListResponse>;
  getCommunicationTypes(): Promise<CommunicationTypesListResponse>;
  getCurrencies(): Promise<CurrenciesListResponse>;
  getVolumes(): Promise<VolumesListResponse>;

  getAllLookupTypes(): Promise<LookupTypesListResponse>;
  getLookupValues(categoryCode: string): Promise<LookupValuesListResponse>;
  createLookupValue(
    categoryCode: string,
    dto: CreateLookupValueDto,
  ): Promise<LookupValueAdminResponse>;
  updateLookupValue(
    categoryCode: string,
    id: number,
    dto: UpdateLookupValueDto,
  ): Promise<LookupValueAdminResponse>;
  deleteLookupValue(categoryCode: string, id: number): Promise<void>;
}
