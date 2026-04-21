import { RoleResponseDto, type EntityPermission, type RoleEntityPermissions } from '../dto/role-response.dto';
import type { Role } from '../../../../core/database/schema';

export class RoleMapper {
  static toResponseDto(entity: Role): RoleResponseDto {
    return {
      id: entity.id,
      guuid: entity.guuid,
      roleName: entity.roleName,
      code: entity.code,
      description: entity.description,
      sortOrder: entity.sortOrder,
      isSystem: entity.isSystem,
    };
  }

  /**
   * Transform entity permissions from array to dictionary format
   * Converts [{entityCode, canView, ...}] to {entityCode: {canView, ...}}
   */
  static toEntityPermissionMap(
    perms: Array<{
      entityCode: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }>,
  ): Record<string, EntityPermission> {
    return perms.reduce(
      (acc, perm) => {
        acc[perm.entityCode] = {
          canView: perm.canView,
          canCreate: perm.canCreate,
          canEdit: perm.canEdit,
          canDelete: perm.canDelete,
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
            canView: false,
            canCreate: false,
            canEdit: false,
            canDelete: false,
            deny: false,
          };
        }

        // Union: if ANY role grants, user has it
        result[entityCode].canView = result[entityCode].canView || perm.canView;
        result[entityCode].canCreate =
          result[entityCode].canCreate || perm.canCreate;
        result[entityCode].canEdit = result[entityCode].canEdit || perm.canEdit;
        result[entityCode].canDelete =
          result[entityCode].canDelete || perm.canDelete;

        // DENY: if ANY role denies, deny is true (overrides all)
        result[entityCode].deny =
          (result[entityCode].deny || perm.deny) ?? false;
      }
    }

    return result;
  }
}
