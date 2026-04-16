import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * RoleGuard — lightweight role-code check.
 *
 * Use when you need only @Roles() enforcement without the full
 * entity-permission resolution that RBACGuard performs.
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
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user?.isSuperAdmin) return true;

    const userRoleCodes = (user?.roles ?? []).map((r) => r.roleCode);
    const hasRole = requiredRoles.some((r) => userRoleCodes.includes(r));

    if (!hasRole) {
      throw new ForbiddenException(
        `Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
