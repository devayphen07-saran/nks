import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_ENTITY_PERMISSION_KEY,
  EntityPermissionRequirement,
} from '../decorators/require-entity-permission.decorator';
import { RoleEntityPermissionRepository } from '../../modules/roles/repositories/role-entity-permission.repository';
import type { AuthenticatedRequest } from './auth.guard';

/**
 * EntityPermissionGuard — checks @RequireEntityPermission() on a route.
 *
 * Standalone alternative to RBACGuard when you need only entity-level
 * permission enforcement without the full role check.
 *
 * Usage:
 *   @UseGuards(AuthGuard, EntityPermissionGuard)
 *   @RequireEntityPermission('INVOICE', 'create')
 *   async createInvoice() {}
 */
@Injectable()
export class EntityPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleEntityPermissionRepository: RoleEntityPermissionRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<
      EntityPermissionRequirement | undefined
    >(REQUIRE_ENTITY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user?.isSuperAdmin) return true;

    const storeId = user?.activeStoreId;
    if (!storeId) {
      throw new ForbiddenException('No active store selected');
    }

    const permissions =
      await this.roleEntityPermissionRepository.getUserEntityPermissions(
        user.userId,
        storeId,
      );

    const entityPerms = permissions[requirement.entityCode];
    if (!entityPerms || entityPerms.deny === true) {
      throw new ForbiddenException(
        `Access denied to entity '${requirement.entityCode}'`,
      );
    }

    const permKey =
      `can${requirement.action.charAt(0).toUpperCase()}${requirement.action.slice(1)}` as keyof typeof entityPerms;

    if (!entityPerms[permKey]) {
      throw new ForbiddenException(
        `Insufficient permissions to ${requirement.action} '${requirement.entityCode}'`,
      );
    }

    return true;
  }
}
