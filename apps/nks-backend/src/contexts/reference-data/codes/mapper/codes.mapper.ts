import type {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from '../dto/codes-response.dto';

interface CategoryRow {
  id: number;
  guuid: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface ValueRow {
  id: number;
  guuid: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  storeGuuid: string | null;
}

export class CodesMapper {
  static buildCategoryDto(categoryRow: CategoryRow): CodeCategoryResponseDto {
    return {
      guuid: categoryRow.guuid,
      code: categoryRow.code,
      name: categoryRow.name,
      description: categoryRow.description ?? null,
      isSystem: categoryRow.isSystem,
    };
  }

  static buildValueDto(valueRow: ValueRow): CodeValueResponseDto {
    return {
      guuid: valueRow.guuid,
      code: valueRow.code,
      label: valueRow.label,
      description: valueRow.description ?? null,
      sortOrder: valueRow.sortOrder ?? null,
      isSystem: valueRow.isSystem,
      storeGuuid: valueRow.storeGuuid ?? null,
    };
  }
}
