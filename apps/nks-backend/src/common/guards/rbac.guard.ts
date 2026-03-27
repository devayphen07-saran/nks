import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../modules/auth/services/auth.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class RBACGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by AuthGuard

    if (!user) {
      return false;
    }

    // 1. Fetch user permissions and roles from DB
    const { roles, permissions, isSuperAdmin } =
      await this.authService.getUserPermissions(user.userId);

    // Attach to request for downstream use (controllers/interceptors)
    request.userRoles = roles;
    request.userPermissions = permissions;

    // 2. Bypass for Super Admin
    if (isSuperAdmin) {
      return true;
    }

    // 3. Check Roles
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const roleCodes = roles.map((r: any) => r.roleCode);
      const hasRole = requiredRoles.some((role: string) =>
        roleCodes.some((rc: string) => rc === role),
      );
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role');
      }
    }

    // 4. Check Permissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((perm) =>
        permissions.includes(perm),
      );
      if (!hasAllPermissions) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}
