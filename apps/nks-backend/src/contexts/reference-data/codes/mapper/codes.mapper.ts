import type {
  CodeCategoryResponseDto,
  CodeValueResponseDto,
} from '../dto/codes-response.dto';

interface CategoryRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

interface ValueRow {
  id: number;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  storeFk: number | null;
}

export class CodesMapper {
  static toCategory(row: CategoryRow): CodeCategoryResponseDto {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description ?? null,
      isSystem: row.isSystem,
    };
  }

  static toValue(row: ValueRow): CodeValueResponseDto {
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      description: row.description ?? null,
      sortOrder: row.sortOrder ?? null,
      isSystem: row.isSystem,
      storeFk: row.storeFk ?? null,
    };
  }
}
