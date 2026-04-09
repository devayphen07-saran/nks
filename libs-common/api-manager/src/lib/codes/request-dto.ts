// ─── Code Category DTOs ───────────────────────────────────────────────────

export interface CodeCategoryResponse {
  id: number;
  code: string;
  title: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder?: number;
}

export type CodeCategoriesListResponse = CodeCategoryResponse[];
export type CodeCategorySingleResponse = CodeCategoryResponse;

// ─── Code Value DTOs ──────────────────────────────────────────────────────

export interface CodeValueResponse {
  id: number;
  categoryId: number;
  categoryCode: string;
  code: string;
  title: string;
  description?: string;
  sortOrder?: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CodeValuesListResponse = CodeValueResponse[];
export type CodeValueSingleResponse = CodeValueResponse;

// ─── Request DTOs ─────────────────────────────────────────────────────────

export interface CreateCodeCategoryRequest {
  code: string;
  title: string;
  description?: string;
}

export interface CreateCodeValueRequest {
  code: string;
  title: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCodeValueRequest {
  code?: string;
  title?: string;
  description?: string;
  sortOrder?: number;
}
