import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesService } from '../../modules/roles/roles.service';
import { ErrorCode } from '../constants/error-codes.constants';

/**
 * PermissionGuard checks if the user has the required permissions
 * Works with @RequirePermission decorator
 *
 * Usage:
 * @UseGuards(PermissionGuard)
 * @RequirePermission('customers', 'edit')
 * async editCustomer() {}
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the resource and action from the decorator metadata
    const resource = this.reflector.get<string>(
      'permission_resource',
      context.getHandler(),
    );
    const action = this.reflector.get<string>(
      'permission_action',
      context.getHandler(),
    );

    // If no permission requirement, allow access
    if (!resource || !action) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user context, deny access
    if (!user || !user.id) {
      throw new ForbiddenException({
        errorCode: ErrorCode.UNAUTHORIZED,
        message: 'User not authenticated',
      });
    }

    // Check if user has the required permission
    const hasPermission = await this.rolesService.checkUserPermission(
      user.id,
      resource,
      action,
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        errorCode: ErrorCode.PERMISSION_DENIED,
        message: `Insufficient permissions: ${resource}.${action}`,
      });
    }

    return true;
  }
}
