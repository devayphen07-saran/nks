import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleEntityPermissionRepository } from '../../modules/roles/repositories/role-entity-permission.repository';
import { PermissionChecker } from '../utils/permission-checker';
import { ErrorCode } from '../constants/error-codes.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  EntityPermissionRequirement,
} from '../decorators/require-entity-permission.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RBACGuard — Role + entity permission access control.
 *
 * Checks @Roles() and @RequireEntityPermission() on the same endpoint.
 * SUPER_ADMIN bypasses all checks.
 *
 * Usage:
 *   @UseGuards(AuthGuard, RBACGuard)
 *   @Roles('STORE_OWNER', 'MANAGER')
 *   @RequireEntityPermission('INVOICE', 'create')
 *   async createInvoice() {}
 */
@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.UNAUTHORIZED,
        message: 'User not found or authenticated',
      });
    }

    // 1. Read roles + isSuperAdmin from request.user (embedded in session by AuthGuard — no DB query)
    const roles = user.roles ?? [];
    const isSuperAdmin = user.isSuperAdmin ?? false;
    request.isSuperAdmin = isSuperAdmin;

    // 2. SUPER_ADMIN bypasses everything
    if (isSuperAdmin) return true;

    // 3. Check required roles (@Roles decorator)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length) {
      // Prevent privilege escalation: a user with STORE_OWNER in store A must not
      // satisfy a @Roles check while their activeStoreId points to store B.
      // A role with storeId=null is store-agnostic and always matches.
      PermissionChecker.assertHasRequiredRoles(roles, requiredRoles, user.activeStoreId);
    }

    // 4. Check granular entity permission (@RequireEntityPermission decorator)
    const entityPermissionReq = this.reflector.getAllAndOverride<
      EntityPermissionRequirement | undefined
    >(REQUIRE_ENTITY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (entityPermissionReq) {
      // Get storeId from authenticated user's active store (not from request parameters)
      // This prevents users from accessing data from stores they don't have access to
      const storeId = user.activeStoreId;

      if (!storeId) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: 'No active store selected',
        });
      }

      // Verify the user actually holds a role in activeStoreId — guards against
      // a session where activeStoreId was set to a store the user no longer belongs to
      PermissionChecker.assertHasRoleInStore(roles, storeId);

      const hasEntityPermission =
        await this.roleEntityPermissionRepository.getUserEntityPermissions(
          user.userId,
          storeId,
        );

      const entityPerms = hasEntityPermission[entityPermissionReq.entityCode];
      if (!entityPerms) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `No access to entity '${entityPermissionReq.entityCode}'`,
        });
      }

      // ───────────────────────────────────────────────────────────────
      // PHASE 1: DENY-OVERRIDES-GRANT PATTERN
      // ───────────────────────────────────────────────────────────────
      // Check if explicitly DENIED (deny column in role_entity_permission)
      // This must be checked BEFORE checking grant permissions
      if (entityPerms.deny === true) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `Access explicitly DENIED to ${entityPermissionReq.action} '${entityPermissionReq.entityCode}' (deny override)`,
        });
      }

      const permissionKey =
        `can${entityPermissionReq.action.charAt(0).toUpperCase()}${entityPermissionReq.action.slice(1)}` as keyof typeof entityPerms;
      const hasAction = entityPerms[permissionKey];

      if (!hasAction) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `Insufficient permissions to ${entityPermissionReq.action} '${entityPermissionReq.entityCode}'`,
        });
      }
    }

    return true;
  }
}
