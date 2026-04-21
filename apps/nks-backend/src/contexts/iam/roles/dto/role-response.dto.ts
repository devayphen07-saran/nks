import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import type { Role } from '../../../../core/database/schema/rbac/roles/roles.table';

// ─── Entity Permission Types ─────────────────────────────────────────────────

export interface EntityPermission {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  deny?: boolean;
}

export interface RoleEntityPermissions {
  [entityCode: string]: EntityPermission;
}

export interface RoutePermission {
  routeId: number;
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
  id: z.number(),
  guuid: z.string(),
  roleName: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  isSystem: z.boolean(),
});

export class RoleResponseDto extends createZodDto(RoleResponseSchema) {}

export interface RouteWithPermissionsRow {
  id: number;
  routeName: string;
  routePath: string;
  fullPath: string;
  iconName: string | null;
  routeType: string;
  routeScope: string;
  isPublic: boolean;
  parentRouteFk: number | null;
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
  storeName: string | null;
}

export interface AuthContextRow {
  isSuperAdmin: boolean;
  activeStoreFk: number | null;
}

// ─── Response envelope types ──────────────────────────────────────────────────

export type RoleResponse = Role;

export interface RoleDetailResponse extends Role {
  entityPermissions: Record<string, EntityPermission>;
  routePermissions: RoutePermission[];
}

export interface CreateRoleResponse {
  data: RoleResponse;
  message: string;
}

export interface RoleDetailedResponse {
  data: RoleDetailResponse;
  message: string;
}

export interface UpdateRoleResponse {
  data: RoleResponse;
  message: string;
}
