import type { CodeValueResponse } from '../dto/lookups-response.dto';

export interface CodeValueRow {
  id: number;
  guuid: string;
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
  static buildCodeValueDto(codeValueRow: CodeValueRow): CodeValueResponse {
    return {
      guuid:       codeValueRow.guuid,
      code:        codeValueRow.code,
      title:       codeValueRow.label,
      description: codeValueRow.description ?? undefined,
      isActive:    codeValueRow.isActive  ?? true,
      isHidden:    codeValueRow.isHidden  ?? false,
      isSystem:    codeValueRow.isSystem  ?? false,
      createdAt:   codeValueRow.createdAt?.toISOString() ?? '',
      updatedAt:   codeValueRow.updatedAt?.toISOString() ?? '',
    };
  }
}
