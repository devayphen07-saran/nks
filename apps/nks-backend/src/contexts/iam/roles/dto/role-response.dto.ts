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

/** Legacy map keyed by entity code — used by RoleEntityPermissionRepository and auth snapshot. */
export interface RoleEntityPermissions {
  [entityCode: string]: EntityPermission;
}

/**
 * Dynamic permission entry for a single entity in the new role_permissions table.
 * `actions` is an open map: any action code returned by the DB is present.
 * `deny = true` means all grants for this entity are suppressed.
 */
export interface DynamicEntityPermissionEntry {
  /** action code (uppercase) → allowed flag. */
  actions: Record<string, boolean>;
  deny: boolean;
}

/**
 * Dynamic permission map returned by RolePermissionsRepository.
 * Keyed by entity code (e.g. 'USER', 'INVOICE').
 */
export interface DynamicEntityPermissions {
  [entityCode: string]: DynamicEntityPermissionEntry;
}

export interface RoutePermission {
  routeGuuid: string;
  routePath: string;
  routeName: string;
  routeScope: string | null;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
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
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
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
  entityPermissions: RoleEntityPermissions;
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
