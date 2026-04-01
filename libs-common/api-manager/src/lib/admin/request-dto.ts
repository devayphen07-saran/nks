// ─── Pagination & Query ───────────────────────────────────────────────────

export interface AdminListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// ─── User Management ──────────────────────────────────────────────────────

export interface UpdateAdminUserRequest {
  userId: number;
  name?: string;
  emailVerified?: boolean;
  isBlocked?: boolean;
}

// ─── Store Management ─────────────────────────────────────────────────────

export interface UpdateAdminStoreRequest {
  storeId: number;
  storeName?: string;
  storeCode?: string;
  status?: string;
}

// ─── Lookup Configuration ─────────────────────────────────────────────────

export interface UpdateLookupConfigRequest {
  configId: number;
  [key: string]: any;
}

// ─── System Settings ──────────────────────────────────────────────────────

export interface UpdateSystemSettingsRequest {
  [key: string]: any;
}
