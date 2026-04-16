/**
 * code-value.mapper.ts
 *
 * Mappers for all lookup types backed by the shared code_value table.
 * These all share the same CodeValueRow shape from the repository.
 */

import type {
  SalutationResponse,
  AddressTypeResponse,
  DesignationResponse,
  StoreLegalTypeResponse,
  StoreCategoryResponse,
} from '../dto/lookups-response.dto';

export interface CodeValueRow {
  id:          number;
  code:        string;
  label:       string;
  description: string | null;
  isActive:    boolean | null;
  isHidden:    boolean | null;
  isSystem:    boolean | null;
  createdAt:   Date   | null;
  updatedAt:   Date   | null;
}

/** Shared base fields common to every code_value-backed lookup. */
function codeValueBase(row: CodeValueRow) {
  return {
    id:        row.id,
    code:      row.code,
    title:     row.label,
    isActive:  row.isActive  ?? true,
    isHidden:  row.isHidden  ?? false,
    isSystem:  row.isSystem  ?? false,
    createdAt: row.createdAt?.toISOString() ?? '',
    updatedAt: row.updatedAt?.toISOString() ?? '',
  };
}

export function toSalutationResponse(row: CodeValueRow): SalutationResponse {
  return codeValueBase(row);
}

export function toAddressTypeResponse(row: CodeValueRow): AddressTypeResponse {
  return { ...codeValueBase(row), description: row.description ?? undefined };
}

export function toDesignationResponse(row: CodeValueRow): DesignationResponse {
  return { ...codeValueBase(row), description: row.description ?? undefined };
}

export function toStoreLegalTypeResponse(row: CodeValueRow): StoreLegalTypeResponse {
  return { ...codeValueBase(row), description: row.description ?? undefined };
}

export function toStoreCategoryResponse(row: CodeValueRow): StoreCategoryResponse {
  return { ...codeValueBase(row), description: row.description ?? undefined };
}
