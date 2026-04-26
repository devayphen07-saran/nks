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
  createdAt: Date;
  updatedAt: Date | null;
}

export class CodeValueMapper {
  static buildCodeValueDto(codeValueRow: CodeValueRow): CodeValueResponse {
    return {
      guuid:       codeValueRow.guuid,
      code:        codeValueRow.code,
      title:       codeValueRow.label,
      description: codeValueRow.description ?? undefined,
    };
  }
}
