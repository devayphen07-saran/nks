import { ForbiddenException } from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes.constants';

type UserRole = { roleCode: string; storeId: number | null };

/**
 * Throws ForbiddenException if the user holds no STORE-scoped role in `storeId`.
 *
 * The `storeId === null` (platform role) bypass is intentionally absent:
 *   - SUPER_ADMIN is checked and short-circuited in RBACGuard before this runs.
 *   - Platform roles (storeId=null) are for PLATFORM-scope endpoints only.
 *     Allowing them to satisfy STORE-scope membership checks would let a user
 *     with only a platform role pass into any store's data — that is wrong.
 */
export function assertHasRoleInStore(
  userRoles: UserRole[],
  storeId: number,
): void {
  const hasRole = userRoles.some((r) => r.storeId === storeId);
  if (!hasRole) {
    throw new ForbiddenException({
      errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
      message: 'No active role in the selected store',
    });
  }
}

