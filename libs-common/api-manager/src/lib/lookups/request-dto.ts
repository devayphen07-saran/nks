// ─── Salutations ────────────────────────────────────────────────────────────

export interface CreateSalutationRequest {
  salutationText: string;
  description?: string;
}

export interface UpdateSalutationRequest {
  salutationText?: string;
  description?: string;
}

export interface SalutationResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface SalutationsListResponse {
  data: SalutationResponse[];
  message: string;
}

// ─── Countries ──────────────────────────────────────────────────────────────

export interface CountryResponse {
  guuid: string;
  countryCode: string;
  countryName: string;
  dialingCode?: string;
  description?: string | null;
}

export interface CountriesListResponse {
  data: CountryResponse[];
  message: string;
}

// ─── Address Types ──────────────────────────────────────────────────────────

export interface AddressTypeResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface AddressTypesListResponse {
  data: AddressTypeResponse[];
  message: string;
}

// ─── Communication Types ────────────────────────────────────────────────────

export interface CommunicationTypeResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  validationRegex?: string | null;
}

export interface CommunicationTypesListResponse {
  data: CommunicationTypeResponse[];
  message: string;
}

// ─── Designations ───────────────────────────────────────────────────────────

export interface DesignationResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface DesignationsListResponse {
  data: DesignationResponse[];
  message: string;
}

// ─── Store Legal Types ──────────────────────────────────────────────────────

export interface StoreLegalTypeResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface StoreLegalTypesListResponse {
  data: StoreLegalTypeResponse[];
  message: string;
}

// ─── Store Categories ───────────────────────────────────────────────────────

export interface StoreCategoryResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

export interface StoreCategoriesListResponse {
  data: StoreCategoryResponse[];
  message: string;
}

// ─── Currencies ─────────────────────────────────────────────────────────────

export interface CurrencyResponse {
  guuid: string;
  code: string;
  symbol?: string;
  title: string;
  description?: string | null;
}

export interface CurrenciesListResponse {
  data: CurrencyResponse[];
  message: string;
}

// ─── Volumes ────────────────────────────────────────────────────────────────

export interface VolumeResponse {
  guuid: string;
  code: string;
  title: string;
  unit?: string;
  description?: string | null;
}

export interface VolumesListResponse {
  data: VolumeResponse[];
  message: string;
}

// ─── Salutations ────────────────────────────────────────────────────────────

export interface CreateSalutationRequest {
  salutationText: string;
  description?: string;
}

export interface UpdateSalutationRequest {
  salutationText?: string;
  description?: string;
}

// ─── Countries ──────────────────────────────────────────────────────────────

export interface CreateCountryRequest {
  countryName: string;
  countryCode: string;
  dialingCode?: string;
  description?: string;
}

export interface UpdateCountryRequest {
  countryName?: string;
  countryCode?: string;
  dialingCode?: string;
  description?: string;
}

// ─── Designations ───────────────────────────────────────────────────────────

export interface CreateDesignationRequest {
  designationName: string;
  designationCode: string;
  description?: string;
}

export interface UpdateDesignationRequest {
  designationName?: string;
  designationCode?: string;
  description?: string;
}

// ─── Store Legal Types ──────────────────────────────────────────────────────

export interface CreateStoreLegalTypeRequest {
  legalTypeName: string;
  legalTypeCode: string;
  description?: string;
}

export interface UpdateStoreLegalTypeRequest {
  legalTypeName?: string;
  legalTypeCode?: string;
  description?: string;
}

// ─── Store Categories ───────────────────────────────────────────────────────

export interface CreateStoreCategoryRequest {
  categoryName: string;
  categoryCode: string;
  description?: string;
}

export interface UpdateStoreCategoryRequest {
  categoryName?: string;
  categoryCode?: string;
  description?: string;
}

// ─── Batch Lookup ────────────────────────────────────────────────────────────

export interface BatchLookupRequest {
  types: string[];
}

// Key = the type code/slug passed in; value = the item list for that type.
// Item shape varies by type — use the per-type response interfaces for stricter
// typing when you know which types you're requesting.
export type BatchLookupItem = {
  guuid: string;
  code: string;
  title?: string;
  label?: string;
  description?: string | null;
  [key: string]: unknown;
};

export type BatchLookupResponse = Record<string, BatchLookupItem[]>;

// ─── Admin: Lookup Configuration ────────────────────────────────────────────

// Request DTOs
export interface CreateLookupValueRequest {
  code:        string;
  label:       string;
  description?: string;
  sortOrder?:   number;
}

export interface UpdateLookupValueRequest {
  code?:        string;
  label?:       string;
  description?: string;
  sortOrder?:   number;
}

// Response DTOs
export interface LookupTypeItem {
  code:       string;
  name:       string;
  isSystem:   boolean;
  valueCount: number;
}

export interface LookupTypesResponse {
  data:    LookupTypeItem[];
  message: string;
}

export interface LookupValueItem {
  id:          number;
  code:        string;
  label:       string;
  description: string | undefined;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  sortOrder:   number | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface LookupValuesResponse {
  data:    LookupValueItem[];
  message: string;
}
