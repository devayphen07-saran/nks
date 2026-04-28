// ─── Role Response ─────────────────────────────────────────────────────────

export interface RoleResponse {
  guuid: string;
  code: string;
  roleName: string;
  description: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  storeGuuid: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface RolesListResponse {
  data: RoleResponse[];
  message: string;
}

// ─── Create Role Request ───────────────────────────────────────────────────

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  storeGuuid: string;
}

// ─── Update Role Request ───────────────────────────────────────────────────

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  sortOrder?: number;
  storeGuuid?: string;
  entityPermissions?: Record<string, Record<string, boolean>>;
  routePermissions?: Array<{
    routeGuuid: string;
    canView?: boolean;
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
  }>;
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
