import type { ApiResponse } from "@nks/shared-types";

// ============================================
// List Query Parameters (for TanStack Query)
// ============================================
export interface StoreListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ============================================
// List Response DTO
// ============================================
export interface StoreListItem {
  id: number;
  storeName: string;
  storeCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreListResponse {
  items: StoreListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================
// Detail Response DTO
// ============================================
export interface StoreDetail extends StoreListItem {
  description?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
}

export type StoreDetailResponse = ApiResponse<StoreDetail>;
export type StoreListApiResponse = ApiResponse<StoreListResponse>;
