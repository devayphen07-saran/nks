import { Injectable } from '@nestjs/common';
import { RoleEntityPermissionRepository } from './repositories/role-entity-permission.repository';
import type { EntityPermissionAction } from '../../common/decorators/require-entity-permission.decorator';

/**
 * PermissionEvaluatorService — centralized entity permission evaluation.
 *
 * Single authoritative place for the check logic used by RBACGuard.
 * Mirrors Ayphen's PrincipalManager pattern.
 *
 * Contract:
 *  - Returns true  → action is permitted
 *  - Returns false → action is denied (no permission row, deny=true, or no storeId)
 *
 * Callers are responsible for:
 *  - SUPER_ADMIN bypass  (check request.user.isSuperAdmin before calling)
 *  - Throwing ForbiddenException when this returns false
 */
@Injectable()
export class PermissionEvaluatorService {
  constructor(
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
  ) {}

  /**
   * Evaluate whether a user can perform `action` on `entityCode` in `activeStoreId`.
   *
   * @param activeStoreId The store context from the session (null = no store selected)
   * @param entityCode    Entity type code, e.g. "INVOICE", "PRODUCT"
   * @param action        One of: view | create | edit | delete
   * @param sessionRoles  Pre-loaded roles from request.user — avoids a second DB round-trip.
   *                      Only roles scoped to activeStoreId are used.
   */
  async evaluate(
    activeStoreId: number | null,
    entityCode: string,
    action: EntityPermissionAction,
    sessionRoles: Array<{ roleId: number; storeId: number | null }>,
  ): Promise<boolean> {
    if (!activeStoreId) return false;

    // Only store-scoped roles contribute to entity permission evaluation.
    // Platform roles (USER, SUPER_ADMIN) have storeId=null and must not influence
    // store entity access — SUPER_ADMIN is already bypassed before reaching here.
    const roleIds = sessionRoles
      .filter((r) => r.storeId === activeStoreId)
      .map((r) => r.roleId);

    const permissions =
      await this.roleEntityPermissionRepository.getEntityPermissionsForRoleIds(roleIds);

    const entityPerms = permissions[entityCode];

    // No permission row or explicit deny
    if (!entityPerms || entityPerms.deny === true) return false;

    // Construct the canXxx flag key: 'view' → 'canView', 'create' → 'canCreate', etc.
    const permKey =
      `can${action.charAt(0).toUpperCase()}${action.slice(1)}` as keyof typeof entityPerms;

    return !!entityPerms[permKey];
  }
}
