/**
 * lookups.mapper.ts
 *
 * Named mapper functions for every lookup entity type, following the same
 * `toResponse(row)` convention used in StatusService — one function per
 * entity, grouped by family.
 *
 * Rules:
 *  - Each function is a pure, side-effect-free transformation.
 *  - Input types mirror the Drizzle select-result shapes from the repository.
 *  - Output types are the public-facing DTO interfaces from lookups-response.dto.ts.
 */

import type {
  SalutationResponse,
  AddressTypeResponse,
  DesignationResponse,
  StoreLegalTypeResponse,
  StoreCategoryResponse,
  CountryResponse,
  CommunicationTypeResponse,
  CurrencyResponse,
  VolumeResponse,
} from './dto/lookups-response.dto';

// ── Shared base shape ────────────────────────────────────────────────────────
// All code_value rows (salutations, address-types, designations, …) come from
// the same table via `codeValueSelect`, so they share this interface.

interface CodeValueRow {
  id: number;
  code: string;
  label: string;
  description: string | null;
  isActive: boolean | null;
  isHidden: boolean | null;
  isSystem: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// ── code_value family ────────────────────────────────────────────────────────

export function toSalutationResponse(row: CodeValueRow): SalutationResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    isActive: row.isActive ?? true,
    isHidden: row.isHidden ?? false,
    isSystem: row.isSystem ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export function toAddressTypeResponse(row: CodeValueRow): AddressTypeResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    description: row.description ?? undefined,
    isActive: row.isActive ?? true,
    isHidden: row.isHidden ?? false,
    isSystem: row.isSystem ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export function toDesignationResponse(row: CodeValueRow): DesignationResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    description: row.description ?? undefined,
    isActive: row.isActive ?? true,
    isHidden: row.isHidden ?? false,
    isSystem: row.isSystem ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export function toStoreLegalTypeResponse(
  row: CodeValueRow,
): StoreLegalTypeResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    description: row.description ?? undefined,
    isActive: row.isActive ?? true,
    isHidden: row.isHidden ?? false,
    isSystem: row.isSystem ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export function toStoreCategoryResponse(
  row: CodeValueRow,
): StoreCategoryResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    description: row.description ?? undefined,
    isActive: row.isActive ?? true,
    isHidden: row.isHidden ?? false,
    isSystem: row.isSystem ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

// ── Dedicated-table entities ─────────────────────────────────────────────────

interface CountryRow {
  id: number;
  isoCode2: string;
  countryName: string;
  dialCode: string | null;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toCountryResponse(row: CountryRow): CountryResponse {
  return {
    id: row.id,
    countryCode: row.isoCode2,
    countryName: row.countryName,
    dialingCode: row.dialCode ?? undefined,
    description: row.description ?? undefined,
    isActive: row.isActive,
    isHidden: row.isHidden,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

interface CommunicationTypeRow {
  id: number;
  code: string;
  label: string;
  description: string | null;
  icon: string | null;
  validationRegex: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
  createdBy: number | null;
  modifiedBy: number | null;
  deletedBy: number | null;
  deletedAt: Date | null;
}

export function toCommunicationTypeResponse(
  row: CommunicationTypeRow,
): CommunicationTypeResponse {
  return {
    id: row.id,
    code: row.code,
    title: row.label,
    description: row.description ?? undefined,
    isActive: row.isActive,
    isHidden: row.isHidden,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

interface CurrencyRow {
  id: number;
  code: string;
  symbol: string | null;
  description: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toCurrencyResponse(row: CurrencyRow): CurrencyResponse {
  return {
    id: row.id,
    code: row.code,
    symbol: row.symbol ?? undefined,
    title: row.symbol ?? row.code,
    description: row.description ?? undefined,
    isActive: row.isActive,
    isHidden: row.isHidden,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

interface VolumeRow {
  id: number;
  volumeCode: string;
  volumeName: string;
  volumeType: string | null;
  isActive: boolean;
  isHidden: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export function toVolumeResponse(row: VolumeRow): VolumeResponse {
  return {
    id: row.id,
    code: row.volumeCode,
    title: row.volumeName,
    unit: row.volumeType ?? undefined,
    description: undefined,
    isActive: row.isActive,
    isHidden: row.isHidden,
    isSystem: row.isSystem,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}
