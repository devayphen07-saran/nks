import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../constants/permission-codes.constants';

/**
 * Metadata key consumed by PermissionGuard.
 * Value is a permission code string in 'resource.action' format, e.g. 'orders.view'.
 */
export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Marks an endpoint as requiring a specific permission.
 * Must be used together with AuthGuard + PermissionGuard.
 *
 * Prefer using PermissionCodes constants to avoid typos:
 * @example
 * import { PermissionCodes } from '../constants/permission-codes.constants';
 *
 * @UseGuards(AuthGuard, PermissionGuard)
 * @RequirePermission(PermissionCodes.ORDERS_VIEW)
 * async listOrders() {}
 *
 * // Or with resource + action (still works):
 * @RequirePermission('products', 'create')
 * async createProduct() {}
 */
export function RequirePermission(
  code: PermissionCode,
): ReturnType<typeof SetMetadata>;
export function RequirePermission(
  resource: string,
  action: string,
): ReturnType<typeof SetMetadata>;
export function RequirePermission(
  codeOrResource: string,
  action?: string,
): ReturnType<typeof SetMetadata> {
  const resolvedCode = action ? `${codeOrResource}.${action}` : codeOrResource;
  return SetMetadata(REQUIRE_PERMISSION_KEY, resolvedCode);
}
