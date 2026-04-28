import type { CodeValueResponse } from '../dto/lookups-response.dto';

export interface CodeValueRow {
  guuid: string;
  code: string;
  label: string;
  description: string | null;
}

export class CodeValueMapper {
  static buildCodeValueDto(row: CodeValueRow): CodeValueResponse {
    return {
      guuid:       row.guuid,
      code:        row.code,
      title:       row.label,
      description: row.description ?? undefined,
    };
  }
}
