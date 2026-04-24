// ── Code-value–backed lookups (salutations, address types, etc.) ─────────────
// All five share the same shape from the code_value table.
export interface CodeValueResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date | string;
  updatedAt: Date | string | null;
}

// ── Dedicated-table lookups (own shape) ───────────────────────────────────────

export interface CountryResponse {
  guuid: string;
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

export interface CommunicationTypeResponse {
  guuid: string;
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
  guuid: string;
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
  guuid: string;
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

export type PublicLookupItem =
  | CodeValueResponse
  | CountryResponse
  | CommunicationTypeResponse
  | CurrencyResponse
  | VolumeResponse;
