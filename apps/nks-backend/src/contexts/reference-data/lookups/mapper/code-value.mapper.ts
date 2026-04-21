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

export class CodeValueMapper {
  /** Shared base fields common to every code_value-backed lookup. */
  private static base(row: CodeValueRow) {
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

  static toSalutation(row: CodeValueRow): SalutationResponse {
    return CodeValueMapper.base(row);
  }

  static toAddressType(row: CodeValueRow): AddressTypeResponse {
    return {
      ...CodeValueMapper.base(row),
      description: row.description ?? undefined,
    };
  }

  static toDesignation(row: CodeValueRow): DesignationResponse {
    return {
      ...CodeValueMapper.base(row),
      description: row.description ?? undefined,
    };
  }

  static toStoreLegalType(row: CodeValueRow): StoreLegalTypeResponse {
    return {
      ...CodeValueMapper.base(row),
      description: row.description ?? undefined,
    };
  }

  static toStoreCategory(row: CodeValueRow): StoreCategoryResponse {
    return {
      ...CodeValueMapper.base(row),
      description: row.description ?? undefined,
    };
  }
}
