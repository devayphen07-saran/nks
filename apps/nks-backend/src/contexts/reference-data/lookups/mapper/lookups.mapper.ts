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

// ── Row shapes ────────────────────────────────────────────────────────────────

interface CountryRow {
  id:          number;
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
  static toCountry(row: CountryRow): CountryResponse {
    return {
      id:          row.id,
      countryCode: row.isoCode2,
      countryName: row.countryName,
      dialingCode: row.dialCode    ?? undefined,
      description: row.description ?? undefined,
      isActive:    row.isActive,
      isHidden:    row.isHidden,
      isSystem:    row.isSystem,
      createdAt:   row.createdAt.toISOString(),
      updatedAt:   row.updatedAt?.toISOString() ?? '',
    };
  }

  static toCommunicationType(row: CommunicationTypeRow): CommunicationTypeResponse {
    return {
      id:          row.id,
      code:        row.code,
      title:       row.label,
      description: row.description ?? undefined,
      isActive:    row.isActive,
      isHidden:    row.isHidden,
      isSystem:    row.isSystem,
      createdAt:   row.createdAt.toISOString(),
      updatedAt:   row.updatedAt?.toISOString() ?? '',
    };
  }

  static toCurrency(row: CurrencyRow): CurrencyResponse {
    return {
      id:          row.id,
      code:        row.code,
      symbol:      row.symbol      ?? undefined,
      title:       row.symbol      ?? row.code,
      description: row.description ?? undefined,
      isActive:    row.isActive,
      isHidden:    row.isHidden,
      isSystem:    row.isSystem,
      createdAt:   row.createdAt.toISOString(),
      updatedAt:   row.updatedAt?.toISOString() ?? '',
    };
  }

  static toVolume(row: VolumeRow): VolumeResponse {
    return {
      id:          row.id,
      code:        row.volumeCode,
      title:       row.volumeName,
      unit:        row.volumeType  ?? undefined,
      description: undefined,
      isActive:    row.isActive,
      isHidden:    row.isHidden,
      isSystem:    row.isSystem,
      createdAt:   row.createdAt.toISOString(),
      updatedAt:   row.updatedAt?.toISOString() ?? '',
    };
  }
}
