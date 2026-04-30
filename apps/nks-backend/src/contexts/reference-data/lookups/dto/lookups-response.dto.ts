import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Batch fetch request ────────────────────────────────────────────────────────

export const BatchLookupRequestSchema = z.object({
  types: z.array(z.string().min(1)).min(1).max(20),
});

export class BatchLookupRequestDto extends createZodDto(BatchLookupRequestSchema) {}

// ── Generic lookup-backed responses (salutations, store legal types, etc.) ───
// Shared shape for any value-list whose rows live in the `lookup` table
// (lookup_type.has_table = false). Dedicated-table lookups (Country, Currency,
// Volume, etc.) have their own response interfaces below.
// Internal flags (isActive, isHidden, isSystem) and audit timestamps are
// intentionally omitted — repositories already filter to active, visible
// records and clients have no use for DB internals in dropdown data.
export interface LookupValueResponse {
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
  | LookupValueResponse
  | CountryResponse
  | CommunicationTypeResponse
  | CurrencyResponse
  | VolumeResponse;

// ── Batch response ─────────────────────────────────────────────────────────────
// Key = the type code or slug the caller passed in.
// Value = the item list (empty array if the type is not found or not public).
export type BatchLookupResponse = Record<string, PublicLookupItem[]>;
