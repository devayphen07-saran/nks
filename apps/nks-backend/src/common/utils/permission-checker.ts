import { ForbiddenException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';

type UserRole = { roleCode: string; storeId: number | null };

// ─── Plain utility functions (no DI needed) ──────────────────────────────────
// These are pure boolean/throw helpers — no DB access, no injected dependencies.
// Import them directly wherever needed; no class instantiation required.

/**
 * Returns true if userRoles contains any of the requiredRoles scoped to activeStoreId.
 * A role with storeId=null is platform-level and matches any store context.
 */
export function hasRequiredRoles(
  userRoles: UserRole[],
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
 * Throws ForbiddenException if the user does not hold any of the requiredRoles
 * in their active store context.
 */
export function assertHasRequiredRoles(
  userRoles: UserRole[],
  requiredRoles: string[],
  activeStoreId: number | null | undefined,
): void {
  if (!hasRequiredRoles(userRoles, requiredRoles, activeStoreId)) {
    throw new ForbiddenException({
      errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: `Insufficient role. Required: ${requiredRoles.join(', ')}`,
    });
  }
}

/**
 * Throws ForbiddenException if the user holds no role in the given storeId.
 * Guards against stale sessions where activeStoreId no longer maps to a membership.
 * A role with storeId=null (platform-level) always satisfies this check.
 */
export function assertHasRoleInStore(
  userRoles: UserRole[],
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

