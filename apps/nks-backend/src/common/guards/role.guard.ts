import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { assertHasRequiredRoles } from '../utils/permission-checker';
import { ErrorCode } from '../constants/error-codes.constants';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RoleGuard — lightweight role-code check.
 *
 * Use when you need only @Roles() enforcement without the full
 * entity-permission resolution that RBACGuard performs.
 *
 * Roles are scoped to user.activeStoreId — a STORE_OWNER in store A cannot
 * satisfy a @Roles check while their session points to store B.
 *
 * Usage:
 *   @UseGuards(AuthGuard, RoleGuard)
 *   @Roles('SUPER_ADMIN', 'STORE_OWNER')
 *   async adminAction() {}
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user?.userId) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.UNAUTHORIZED,
        message: 'User not found or authenticated',
      });
    }

    if (user.isSuperAdmin) return true;

    assertHasRequiredRoles(
      user?.roles ?? [],
      requiredRoles,
      user?.activeStoreId,
    );

    return true;
  }
}
