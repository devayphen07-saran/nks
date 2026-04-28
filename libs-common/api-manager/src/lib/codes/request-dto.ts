// ─── Code Category DTOs ───────────────────────────────────────────────────

export interface CodeCategoryResponse {
  guuid: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
}

export type CodeCategoriesListResponse = CodeCategoryResponse[];
export type CodeCategorySingleResponse = CodeCategoryResponse;

// ─── Code Value DTOs ──────────────────────────────────────────────────────

export interface CodeValueResponse {
  guuid: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  storeGuuid: string | null;
}

export type CodeValuesListResponse = CodeValueResponse[];
export type CodeValueSingleResponse = CodeValueResponse;

// ─── Request DTOs ─────────────────────────────────────────────────────────

export interface CreateCodeCategoryRequest {
  code: string;
  name: string;
  description?: string;
}

export interface CreateCodeValueRequest {
  code: string;
  label: string;
  description?: string;
  sortOrder?: number;
  storeGuuid?: string;
}

export interface UpdateCodeValueRequest {
  code?: string;
  label?: string;
  description?: string;
  sortOrder?: number;
}
