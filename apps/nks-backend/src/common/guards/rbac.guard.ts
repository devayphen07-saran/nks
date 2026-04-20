import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionEvaluatorService } from '../../modules/roles/permission-evaluator.service';
import { StoresRepository } from '../../modules/stores/repositories/stores.repository';
import { assertHasRoleInStore } from '../utils/permission-checker';
import { ErrorCode } from '../constants/error-codes.constants';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  EntityPermissionRequirement,
} from '../decorators/require-entity-permission.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RBACGuard — Entity permission access control.
 *
 * Checks @RequireEntityPermission() on each endpoint.
 * SUPER_ADMIN bypasses all checks.
 * Delegates permission evaluation to PermissionEvaluatorService.
 *
 * Usage:
 *   @UseGuards(AuthGuard, RBACGuard)
 *   @RequireEntityPermission({ entityCode: EntityCodes.INVOICE, action: 'create' })
 *   async createInvoice() {}
 *
 * Or with the composite decorator:
 *   @RequirePermission(EntityCodes.INVOICE, 'create')
 *   async createInvoice() {}
 */
@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly storesRepository: StoresRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.UNAUTHORIZED,
        message: 'User not found or authenticated',
      });
    }

    // SUPER_ADMIN bypasses all entity permission checks
    if (user.isSuperAdmin) return true;

    const entityPermissionReq = this.reflector.getAllAndOverride<
      EntityPermissionRequirement | undefined
    >(REQUIRE_ENTITY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!entityPermissionReq) return true;

    const resolvedEntityCode = entityPermissionReq.entityCode;
    if (!resolvedEntityCode) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Invalid permission configuration: entityCode is required',
      });
    }

    // Get storeId from authenticated user's active store (not from request parameters).
    // This prevents users from accessing data from stores they don't have access to.
    const storeId = user.activeStoreId;

    if (!storeId) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'No active store selected',
      });
    }

    // Verify the store still exists and has not been soft-deleted.
    // A user may hold a valid session with activeStoreId pointing to a store
    // that was deleted after the session was created.
    const store = await this.storesRepository.findActiveById(storeId);
    if (!store) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Store not found',
      });
    }
    if (store.deletedAt) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Store has been deleted',
      });
    }

    // Verify the user actually holds a role in activeStoreId — guards against
    // a session where activeStoreId was set to a store the user no longer belongs to.
    assertHasRoleInStore(user.roles ?? [], storeId);

    const permitted = await this.permissionEvaluator.evaluate(
      storeId,
      resolvedEntityCode,
      entityPermissionReq.action,
      user.roles ?? [],
    );

    if (!permitted) {
      throw new ForbiddenException({
        errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'Insufficient permissions',
      });
    }

    return true;
  }
}
