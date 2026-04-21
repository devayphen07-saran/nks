export interface SalutationResponse {
  id: number;
  code: string;
  title: string;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface CountryResponse {
  id: number;
  countryCode: string;
  countryName: string;
  dialingCode?: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface AddressTypeResponse {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface CommunicationTypeResponse {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface DesignationResponse {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface StoreLegalTypeResponse {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface StoreCategoryResponse {
  id: number;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface CurrencyResponse {
  id: number;
  code: string;
  symbol?: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface VolumeResponse {
  id: number;
  code: string;
  title: string;
  unit?: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

// ── NEW: Phase 1 Normalization Lookup Tables ────────────────────────────────

export interface PlanTypeResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface TaxLineStatusResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface EntityTypeResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface NotificationStatusResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isTerminal?: boolean | null;
  isError?: boolean | null;
  retryable?: boolean | null;
  displayOrder?: number | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface StaffInviteStatusResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isTerminal?: boolean | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface BillingFrequencyResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface TaxRegistrationTypeResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

export interface TaxFilingFrequencyResponse {
  id: number;
  code: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

// ── Response Type Aliases ────────────────────────────────────────────────────

export type SalutationsListResponse = SalutationResponse[];
export type CountriesListResponse = CountryResponse[];
export type AddressTypesListResponse = AddressTypeResponse[];
export type CommunicationTypesListResponse = CommunicationTypeResponse[];
export type DesignationsListResponse = DesignationResponse[];
export type StoreLegalTypesListResponse = StoreLegalTypeResponse[];
export type StoreCategoriesListResponse = StoreCategoryResponse[];
export type CurrenciesListResponse = CurrencyResponse[];
export type VolumesListResponse = VolumeResponse[];

// Phase 1 Normalization Lookup Tables
export type PlanTypesListResponse = PlanTypeResponse[];
export type TaxLineStatusesListResponse = TaxLineStatusResponse[];
export type EntityTypesListResponse = EntityTypeResponse[];
export type NotificationStatusesListResponse = NotificationStatusResponse[];
export type StaffInviteStatusesListResponse = StaffInviteStatusResponse[];
export type BillingFrequenciesListResponse = BillingFrequencyResponse[];
export type TaxRegistrationTypesListResponse = TaxRegistrationTypeResponse[];
export type TaxFilingFrequenciesListResponse = TaxFilingFrequencyResponse[];
