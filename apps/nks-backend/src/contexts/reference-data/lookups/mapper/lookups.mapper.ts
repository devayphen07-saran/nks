/**
 * lookups.mapper.ts
 *
 * Mappers for lookup entities that have their own dedicated tables
 * (country, communication-type, currency, volume).
 *
 * Code-value–backed lookups (salutation, address-type, designation,
 * store-legal-type, store-category) live in code-value.mapper.ts.
 */

export { CodeValueMapper } from './code-value.mapper';
export type { CodeValueRow } from './code-value.mapper';

import type {
  CountryResponse,
  CommunicationTypeResponse,
  CurrencyResponse,
  VolumeResponse,
} from '../dto/lookups-response.dto';
import type { LookupValueAdminResponse } from '../dto/admin-lookups.dto';

// ── Admin row shape ───────────────────────────────────────────────────────────

interface AdminLookupValueRow {
  id:          number;
  guuid:       string;
  code:        string;
  label:       string;
  description: string | null;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  sortOrder:   number | null;
  createdAt:   Date;
  updatedAt:   Date | null;
}

export class AdminLookupMapper {
  static buildLookupValueDto(row: AdminLookupValueRow): LookupValueAdminResponse {
    return {
      guuid:       row.guuid,
      code:        row.code,
      label:       row.label,
      description: row.description ?? undefined,
      isActive:    row.isActive,
      isHidden:    row.isHidden,
      isSystem:    row.isSystem,
      sortOrder:   row.sortOrder,
      createdAt:   row.createdAt.toISOString(),
      updatedAt:   row.updatedAt?.toISOString() ?? null,
    };
  }
}

// ── Row shapes ────────────────────────────────────────────────────────────────

interface CountryRow {
  id:          number;
  guuid:       string;
  isoCode2:    string;
  countryName: string;
  dialCode:    string | null;
  description: string | null;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  createdAt:   Date;
  updatedAt:   Date | null;
}

interface CommunicationTypeRow {
  id:              number;
  guuid:           string;
  code:            string;
  label:           string;
  description:     string | null;
  icon:            string | null;
  validationRegex: string | null;
  isActive:        boolean;
  isHidden:        boolean;
  isSystem:        boolean;
  createdAt:       Date;
  updatedAt:       Date | null;
  createdBy:       number | null;
  modifiedBy:      number | null;
  deletedBy:       number | null;
  deletedAt:       Date | null;
}

interface CurrencyRow {
  id:          number;
  guuid:       string;
  code:        string;
  symbol:      string | null;
  description: string | null;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  createdAt:   Date;
  updatedAt:   Date | null;
}

interface VolumeRow {
  id:          number;
  guuid:       string;
  volumeCode:  string;
  volumeName:  string;
  volumeType:  string | null;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  createdAt:   Date;
  updatedAt:   Date | null;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

export class LookupMapper {
  static buildCountryDto(countryRow: CountryRow): CountryResponse {
    return {
      guuid:       countryRow.guuid,
      countryCode: countryRow.isoCode2,
      countryName: countryRow.countryName,
      dialingCode: countryRow.dialCode    ?? undefined,
      description: countryRow.description ?? undefined,
    };
  }

  static buildCommunicationTypeDto(communicationTypeRow: CommunicationTypeRow): CommunicationTypeResponse {
    return {
      guuid:           communicationTypeRow.guuid,
      code:            communicationTypeRow.code,
      title:           communicationTypeRow.label,
      description:     communicationTypeRow.description     ?? undefined,
      icon:            communicationTypeRow.icon             ?? undefined,
      validationRegex: communicationTypeRow.validationRegex ?? undefined,
    };
  }

  static buildCurrencyDto(currencyRow: CurrencyRow): CurrencyResponse {
    return {
      guuid:       currencyRow.guuid,
      code:        currencyRow.code,
      symbol:      currencyRow.symbol      ?? undefined,
      title:       currencyRow.symbol      ?? currencyRow.code,
      description: currencyRow.description ?? undefined,
    };
  }

  static buildVolumeDto(volumeRow: VolumeRow): VolumeResponse {
    return {
      guuid:       volumeRow.guuid,
      code:        volumeRow.volumeCode,
      title:       volumeRow.volumeName,
      unit:        volumeRow.volumeType ?? undefined,
    };
  }
}
