import { Injectable, ForbiddenException } from '@nestjs/common';
import { RolesRepository } from '../../modules/roles/repositories/roles.repository';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * PermissionChecker
 *
 * Single source of truth for all permission evaluation logic.
 * Previously scattered across RBACGuard, RolesService, and audit module —
 * centralizing here ensures a security bug fix applies everywhere at once.
 *
 * Inject this service wherever role/store-ownership checks are needed.
 */
@Injectable()
export class PermissionChecker {
  constructor(private readonly rolesRepository: RolesRepository) {}

  /**
   * Asserts that userId is a STORE_OWNER in storeId.
   * Throws ForbiddenException with a consistent error code on failure.
   * Replaces the repeated inline pattern in RolesService.
   */
  async assertStoreOwner(
    userId: number,
    storeId: number,
    message = 'You can only perform this action for stores you own',
  ): Promise<void> {
    const isOwner = await this.rolesRepository.isStoreOwner(userId, storeId);
    if (!isOwner) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message,
      });
    }
  }

  /**
   * Evaluates whether userRoles satisfies any of the requiredRoles,
   * scoped to the user's activeStoreId.
   *
   * Rules:
   * - A role with storeId = null is store-agnostic and always matches.
   * - A role with storeId set must equal activeStoreId (prevents privilege escalation
   *   across stores — e.g. STORE_OWNER in store A must not satisfy a check in store B).
   */
  static hasRequiredRoles(
    userRoles: Array<{ roleCode: string; storeId: number | null }>,
    requiredRoles: string[],
    activeStoreId: number | null | undefined,
  ): boolean {
    return requiredRoles.some((required) =>
      userRoles.some(
        (r) =>
          r.roleCode === required &&
          (r.storeId === null || r.storeId === activeStoreId),
      ),
    );
  }

  /**
   * Asserts that the user holds at least one of the requiredRoles in their active store.
   * Throws ForbiddenException if the check fails.
   */
  static assertHasRequiredRoles(
    userRoles: Array<{ roleCode: string; storeId: number | null }>,
    requiredRoles: string[],
    activeStoreId: number | null | undefined,
  ): void {
    if (!PermissionChecker.hasRequiredRoles(userRoles, requiredRoles, activeStoreId)) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: `Insufficient role. Required: ${requiredRoles.join(', ')}`,
      });
    }
  }

  /**
   * Asserts that the user holds any role in the given storeId.
   * Used to prevent sessions where activeStoreId no longer matches a real membership.
   *
   * A role with storeId=null is store-agnostic (platform-level) and always satisfies
   * the check — consistent with hasRequiredRoles() behaviour.
   */
  static assertHasRoleInStore(
    userRoles: Array<{ roleCode: string; storeId: number | null }>,
    storeId: number,
  ): void {
    const hasRole = userRoles.some(
      (r) => r.storeId === null || r.storeId === storeId,
    );
    if (!hasRole) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'No active role in the selected store',
      });
    }
  }
}
