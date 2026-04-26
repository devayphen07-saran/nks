// ── Code-value–backed lookups (salutations, address types, etc.) ─────────────
// All five share the same shape from the code_value table.
// Internal flags (isActive, isHidden, isSystem) and audit timestamps are
// intentionally omitted — repositories already filter to active, visible
// records and clients have no use for DB internals in dropdown data.
export interface CodeValueResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
}

// ── Dedicated-table lookups (own shape) ───────────────────────────────────────

export interface CountryResponse {
  guuid: string;
  countryCode: string;
  countryName: string;
  dialingCode?: string;
  description?: string | null;
}

export interface CommunicationTypeResponse {
  guuid: string;
  code: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  validationRegex?: string | null;
}

export interface CurrencyResponse {
  guuid: string;
  code: string;
  symbol?: string;
  title: string;
  description?: string | null;
}

export interface VolumeResponse {
  guuid: string;
  code: string;
  title: string;
  unit?: string;
  description?: string | null;
}

export type PublicLookupItem =
  | CodeValueResponse
  | CountryResponse
  | CommunicationTypeResponse
  | CurrencyResponse
  | VolumeResponse;
