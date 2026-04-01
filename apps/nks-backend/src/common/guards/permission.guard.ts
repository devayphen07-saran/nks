import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesRepository } from '../../modules/roles/roles.repository';
import { ErrorCode } from '../constants/error-codes.constants';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * PermissionGuard — store-scoped per-request permission enforcement.
 *
 * Must run AFTER AuthGuard (relies on request.user and request.session.token).
 *
 * Flow:
 *  1. Read required permission code from @RequirePermission decorator.
 *  2. If no permission required, pass through.
 *  3. Resolve permission codes from the user's active store (scoped via session token).
 *     - SUPER_ADMIN bypasses all checks.
 *     - Store users only inherit permissions from roles in their ACTIVE store.
 *  4. Cache result on request.userPermissions so subsequent guards in the
 *     same request (e.g. RBACGuard) don't re-query.
 *  5. Deny with 403 if the required code is not in the user's permission set.
 *
 * Usage:
 *   @UseGuards(AuthGuard, PermissionGuard)
 *   @RequirePermission('orders', 'view')
 *   async listOrders() {}
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesRepository: RolesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Read required permission from decorator
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission requirement — pass through
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PERMISSION_DENIED,
        message: 'User not authenticated',
      });
    }

    // 2. Populate permission cache if not already done this request
    if (request.userPermissions === undefined) {
      const token = request.session?.token;
      if (!token) {
        throw new ForbiddenException({
          errorCode: ErrorCode.PERMISSION_DENIED,
          message: 'Session token missing',
        });
      }

      const { isSuperAdmin, permissionCodes } =
        await this.rolesRepository.getActiveStorePermissionCodes(
          user.userId,
          token,
        );

      request.isSuperAdmin = isSuperAdmin;
      request.userPermissions = new Set(permissionCodes);
    }

    // 3. SUPER_ADMIN bypasses all permission checks
    if (request.isSuperAdmin) return true;

    // 4. Check required permission against the user's active-store permission set
    if (request.userPermissions.has(required)) return true;

    throw new ForbiddenException({
      errorCode: ErrorCode.PERMISSION_DENIED,
      message: `Insufficient permissions: requires '${required}'`,
    });
  }
}
