import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── Entity Permission Types ─────────────────────────────────────────────────

/** Fixed-column permission shape used by PermissionsSnapshot and the role detail response. */
export interface EntityPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deny?: boolean;
}

/**
 * One node in the hierarchical entity permission tree returned by getRoleWithPermissions.
 * Leaf nodes have children = [].
 * Groups (parent nodes) may themselves have permissions if they are also permissioned entities.
 */
export interface EntityPermissionNode {
  code: string;
  label: string;
  description: string | null;
  defaultAllow: boolean;
  sortOrder: number | null;
  isHidden: boolean;
  permissions: EntityPermission | null;
  children: EntityPermissionNode[];
}

/** Legacy map keyed by entity code — used by RoleEntityPermissionRepository and auth snapshot. */
export interface RoleEntityPermissions {
  [entityCode: string]: EntityPermission;
}

export interface RoutePermission {
  routeGuuid: string;
  routePath: string;
  routeName: string;
  routeScope: string | null;
}

const RoleResponseSchema = z.object({
  guuid: z.string(),
  roleName: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  isSystem: z.boolean(),
});

export class RoleResponseDto extends createZodDto(RoleResponseSchema) {}

export interface RouteWithPermissionsRow {
  guuid: string;
  routeName: string;
  routePath: string;
  fullPath: string;
  iconName: string | null;
  routeType: string;
  routeScope: string;
  isPublic: boolean;
  sortOrder: number | null;
}

// ─── Repository Row Types ────────────────────────────────────────────────────

export interface UserRoleRow {
  roleId: number;
  roleCode: string;
  isSystem: boolean;
  storeFk: number | null;
  isPrimary: boolean;
}

export interface UserRoleWithStoreRow extends UserRoleRow {
  storeGuuid: string | null;
  storeName: string | null;
}

export interface AuthContextRow {
  isSuperAdmin: boolean;
  activeStoreFk: number | null;
}

// ─── Response envelope types ──────────────────────────────────────────────────

export interface RoleDetailResponse {
  guuid: string;
  roleName: string;
  code: string;
  description: string | null;
  sortOrder: number | null;
  isSystem: boolean;
  storeGuuid: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  entityPermissions: EntityPermissionNode[];
  routePermissions: RoutePermission[];
}

export interface CreateRoleResponse {
  data: RoleResponseDto;
  message: string;
}

export interface RoleDetailedResponse {
  data: RoleDetailResponse;
  message: string;
}

export interface UpdateRoleResponse {
  data: RoleResponseDto;
  message: string;
}
