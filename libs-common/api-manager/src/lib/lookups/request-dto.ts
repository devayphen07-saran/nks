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
  id: number;
  code: string;
  title: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalutationsListResponse {
  data: {
    data: SalutationResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Countries ──────────────────────────────────────────────────────────────

export interface CountryResponse {
  id: number;
  countryCode: string;
  countryName: string;
  dialingCode?: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CountriesListResponse {
  data: {
    data: CountryResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Address Types ──────────────────────────────────────────────────────────

export interface AddressTypeResponse {
  id: number;
  code: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressTypesListResponse {
  data: {
    data: AddressTypeResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Communication Types ────────────────────────────────────────────────────

export interface CommunicationTypeResponse {
  id: number;
  code: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationTypesListResponse {
  data: {
    data: CommunicationTypeResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Designations ───────────────────────────────────────────────────────────

export interface DesignationResponse {
  id: number;
  code: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationsListResponse {
  data: {
    data: DesignationResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Store Legal Types ──────────────────────────────────────────────────────

export interface StoreLegalTypeResponse {
  id: number;
  code: string;
  name: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreLegalTypesListResponse {
  data: {
    data: StoreLegalTypeResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Store Categories ───────────────────────────────────────────────────────

export interface StoreCategoryResponse {
  id: number;
  code: string;
  name: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCategoriesListResponse {
  data: {
    data: StoreCategoryResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Currencies ─────────────────────────────────────────────────────────────

export interface CurrencyResponse {
  id: number;
  code: string;
  symbol?: string;
  title: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrenciesListResponse {
  data: {
    data: CurrencyResponse[];
    message: string;
  };
  message: string;
  status: string;
}

// ─── Volumes ────────────────────────────────────────────────────────────────

export interface VolumeResponse {
  id: number;
  code: string;
  title: string;
  unit?: string;
  description?: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VolumesListResponse {
  data: {
    data: VolumeResponse[];
    message: string;
  };
  message: string;
  status: string;
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
