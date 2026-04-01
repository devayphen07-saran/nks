import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/services/auth.service';
import { RolesRepository } from '../../modules/roles/roles.repository';
import { RoleEntityPermissionRepository } from '../../modules/roles/role-entity-permission.repository';
import { ErrorCode } from '../constants/error-codes.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  EntityPermissionRequirement,
} from '../decorators/require-entity-permission.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RBACGuard — Role + permission access control.
 *
 * Checks @Roles() and @RequirePermission() on the same endpoint.
 * SUPER_ADMIN bypasses all checks.
 *
 * Reuses request.userPermissions cache populated by PermissionGuard to
 * avoid a second DB round-trip when both guards are applied.
 *
 * Usage:
 *   @UseGuards(AuthGuard, RBACGuard)
 *   @Roles('STORE_OWNER', 'STORE_MANAGER')
 *   @RequirePermission('products', 'create')
 *   async createProduct() {}
 */
@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly rolesRepository: RolesRepository,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PERMISSION_DENIED,
        message: 'User not found or authenticated',
      });
    }

    // 1. Fetch roles + populate permission cache if not already done
    if (request.userPermissions === undefined) {
      const token = request.session?.token;
      if (token) {
        const { isSuperAdmin, permissionCodes } =
          await this.rolesRepository.getActiveStorePermissionCodes(
            user.userId,
            token,
          );
        request.isSuperAdmin = isSuperAdmin;
        request.userPermissions = new Set(permissionCodes);
      }
    }

    // 2. Fetch role codes for role-based checks (lightweight — already have roles from auth context)
    const { roles, isSuperAdmin } = await this.authService.getUserPermissions(
      user.userId,
    );
    request.isSuperAdmin = request.isSuperAdmin ?? isSuperAdmin;

    // 3. SUPER_ADMIN bypasses everything
    if (request.isSuperAdmin) return true;

    // 4. Check required roles (@Roles decorator)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles?.length) {
      const userRoleCodes = roles.map((r: { roleCode: string }) => r.roleCode);
      const hasRole = requiredRoles.some((r) => userRoleCodes.includes(r));
      if (!hasRole) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `Insufficient role. Required: ${requiredRoles.join(', ')}`,
        });
      }
    }

    // 5. Check required permission (@RequirePermission decorator) — uses cached set
    const required = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (
      required &&
      request.userPermissions &&
      !request.userPermissions.has(required)
    ) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: `Insufficient permissions: requires '${required}'`,
      });
    }

    // 6. Check granular entity permission (@RequireEntityPermission decorator)
    const entityPermissionReq = this.reflector.getAllAndOverride<
      EntityPermissionRequirement | undefined
    >(REQUIRE_ENTITY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (entityPermissionReq) {
      // Get store ID from query params or body
      const storeId =
        request.query.storeId ||
        (request.body && typeof request.body === 'object'
          ? (request.body as Record<string, unknown>).storeId
          : null) ||
        1; // Default to store 1 if not provided

      const hasEntityPermission =
        await this.roleEntityPermissionRepository.getUserEntityPermissions(
          user.userId,
          Number(storeId),
        );

      const entityPerms = hasEntityPermission[entityPermissionReq.entityCode];
      if (!entityPerms) {
        throw new ForbiddenException({
          errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
          message: `No access to entity '${entityPermissionReq.entityCode}'`,
        });
      }

      // Type-safe permission check
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
