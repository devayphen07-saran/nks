// ─── Role Response ─────────────────────────────────────────────────────────

export interface RoleResponse {
  id: number;
  code: string;
  roleName: string;
  description?: string;
  storeFk: number;
  sortOrder?: number;
  isActive: boolean;
  isSystem: boolean;
  createdBy?: number;
  modifiedBy?: number;
  deletedBy?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface RolesListResponse {
  rows: RoleResponse[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Create Role Request ───────────────────────────────────────────────────

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  storeId: number;
}

// ─── Update Role Request ───────────────────────────────────────────────────

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  sortOrder?: number;
}

// ─── Custom Role Assignment ────────────────────────────────────────────────

export interface AssignCustomRoleRequest {
  userId: number;
  storeId: number;
  customRoleId: number;
}

export interface RemoveCustomRoleRequest {
  userId: number;
  storeId: number;
}
