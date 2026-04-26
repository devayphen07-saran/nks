import {
  RoleResponseDto,
  type EntityPermission,
  type EntityPermissionNode,
  type RoleEntityPermissions,
  type RoleDetailResponse,
  type RoutePermission,
} from '../dto/role-response.dto';
import type { EntityTypeRow } from '../repositories/role-permissions.repository';
import type { Role } from '../../../../core/database/schema';

export class RoleMapper {
  static buildRoleDetailDto(
    role: Role,
    storeGuuid: string | null,
    entityPermissions: EntityPermissionNode[],
    routePermissions: RoutePermission[],
  ): RoleDetailResponse {
    return {
      guuid: role.guuid,
      roleName: role.roleName,
      code: role.code,
      description: role.description ?? null,
      sortOrder: role.sortOrder ?? null,
      isSystem: role.isSystem,
      storeGuuid,
      isActive: role.isActive,
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt?.toISOString() ?? null,
      entityPermissions,
      routePermissions,
    };
  }

  /**
   * Build a hierarchical permission tree from a flat entity list + flat permission map.
   *
   * Algorithm:
   *  1. Build a node map (code → EntityPermissionNode) from all entity rows.
   *  2. Wire children into their parent node.
   *  3. Collect root nodes (parentCode === null) as the top-level array.
   *
   * Entities without explicit permissions in `flatPermissions` get permissions: null,
   * meaning the role has no explicit grant/deny for that entity.
   * Groups (parent-only entities) may have permissions: null but still have children.
   */
  static buildEntityPermissionTree(
    entityRows: EntityTypeRow[],
    flatPermissions: RoleEntityPermissions,
  ): EntityPermissionNode[] {
    const nodeMap = new Map<string, EntityPermissionNode>();

    for (const row of entityRows) {
      const perm = flatPermissions[row.code] ?? null;
      nodeMap.set(row.code, {
        code:        row.code,
        label:       row.label,
        description: row.description,
        defaultAllow: row.defaultAllow,
        sortOrder:   row.sortOrder,
        isHidden:    row.isHidden,
        permissions: perm,
        children:    [],
      });
    }

    const roots: EntityPermissionNode[] = [];
    for (const row of entityRows) {
      const node = nodeMap.get(row.code)!;
      if (row.parentCode === null) {
        roots.push(node);
      } else {
        const parentNode = nodeMap.get(row.parentCode);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          roots.push(node);
        }
      }
    }

    return roots;
  }

  static buildRoleDto(role: Role): RoleResponseDto {
    return {
      guuid: role.guuid,
      roleName: role.roleName,
      code: role.code,
      description: role.description,
      sortOrder: role.sortOrder,
      isSystem: role.isSystem,
    };
  }

  /**
   * Transform entity permissions from array to dictionary format
   * Converts [{entityCode, canView, ...}] to {entityCode: {canView, ...}}
   */
  static buildEntityPermissionMap(
    perms: Array<{
      entityCode: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canExport?: boolean;
      canApprove?: boolean;
      canArchive?: boolean;
      deny?: boolean;
    }>,
  ): Record<string, EntityPermission> {
    return perms.reduce(
      (acc, perm) => {
        acc[perm.entityCode] = {
          canView:    perm.canView,
          canCreate:  perm.canCreate,
          canEdit:    perm.canEdit,
          canDelete:  perm.canDelete,
          canExport:  perm.canExport  ?? false,
          canApprove: perm.canApprove ?? false,
          canArchive: perm.canArchive ?? false,
          deny:       perm.deny ?? false,
        };
        return acc;
      },
      {} as Record<string, EntityPermission>,
    );
  }

  /**
   * Merge multiple permission sets using union grant logic
   * Used when building permissions across multiple stores/roles.
   *
   * Logic:
   * - Allow permissions: OR (if ANY role grants, user has it)
   * - Deny: OR (if ANY role denies, access is denied)
   */
  static mergePermissions(allPermissions: RoleEntityPermissions[]): RoleEntityPermissions {
    const result: RoleEntityPermissions = {};

    for (const perms of allPermissions) {
      for (const [entityCode, perm] of Object.entries(perms)) {
        if (!result[entityCode]) {
          result[entityCode] = {
            canView:    false,
            canCreate:  false,
            canEdit:    false,
            canDelete:  false,
            canExport:  false,
            canApprove: false,
            canArchive: false,
            deny:       false,
          };
        }

        // Union: if ANY role grants, user has it
        result[entityCode].canView    = result[entityCode].canView    || perm.canView;
        result[entityCode].canCreate  = result[entityCode].canCreate  || perm.canCreate;
        result[entityCode].canEdit    = result[entityCode].canEdit    || perm.canEdit;
        result[entityCode].canDelete  = result[entityCode].canDelete  || perm.canDelete;
        result[entityCode].canExport  = result[entityCode].canExport  || perm.canExport;
        result[entityCode].canApprove = result[entityCode].canApprove || perm.canApprove;
        result[entityCode].canArchive = result[entityCode].canArchive || perm.canArchive;

        // DENY: if ANY role denies, deny is true (overrides all)
        result[entityCode].deny = (result[entityCode].deny || perm.deny) ?? false;
      }
    }

    return result;
  }
}
