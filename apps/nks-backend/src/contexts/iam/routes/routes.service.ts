import { Injectable, Logger } from '@nestjs/common';
import { RouteMapper } from './mapper/route.mapper';
import { RoleQueryService } from '../roles/role-query.service';
import { PermissionsRepository } from '../roles/repositories/role-permissions.repository';
import { RoutesValidator } from './validators';
import type { UserRoutesResponseDto, StoreRoutesResponseDto } from './dto/route-response.dto';
import type { SessionUser } from '../auth/interfaces/session-user.interface';
import type { PartialRoute } from './dto/routes.interface';

/**
 * Derives all capability flags from entity permissions — the single source of truth.
 *
 * Route permissions (role_route_mapping) control only whether a route appears in
 * the navigation tree (allow = true). Capability flags are always determined by
 * role_permissions, keeping the UI and API consistent: a user who cannot call
 * the API for an entity will also see all capability flags as false for that route.
 *
 * Routes with no entity binding (entityTypeFk = null) are always accessible
 * (hasAccess: true, canView: true) — they are structural routes (dashboard,
 * settings) that have no corresponding API entity to check permissions against.
 */
function annotateRoutePermissions(
  routes: PartialRoute[],
  permMap: Map<number, Set<string>>,
): PartialRoute[] {
  return routes.map((r) => {
    // No entity binding — structural route (dashboard, settings shell). Always accessible.
    if (r.entityTypeFk === null) {
      return { ...r, hasAccess: true, canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false };
    }
    // Entity is universally readable (defaultAllow = true) — grant VIEW without an explicit role_permissions row.
    // CRUD remains false: default-allow is blanket VIEW only, not write access.
    if (r.defaultAllow) {
      return { ...r, hasAccess: true, canView: true, canCreate: false, canEdit: false, canDelete: false, canExport: false };
    }
    const actions = permMap.get(r.entityTypeFk);
    return {
      ...r,
      hasAccess: actions?.has((r.defaultAction ?? 'VIEW').toUpperCase()) ?? false,
      canView:   actions?.has('VIEW')   ?? false,
      canCreate: actions?.has('CREATE') ?? false,
      canEdit:   actions?.has('EDIT')   ?? false,
      canDelete: actions?.has('DELETE') ?? false,
      canExport: actions?.has('EXPORT') ?? false,
    };
  });
}

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    private readonly roleQuery: RoleQueryService,
    private readonly permissionsRepository: PermissionsRepository,
  ) {}

  async getAdminRoutes(caller: SessionUser): Promise<UserRoutesResponseDto> {
    const userRoles = await this.roleQuery.listUserRoles(caller.userId);
    const roleIds = userRoles.map((r) => r.roleId);

    if (roleIds.length === 0) {
      return RouteMapper.buildUserRoutesDto(caller, []);
    }

    const [routeRows, permMap] = await Promise.all([
      this.permissionsRepository.findAdminRoutesByRoleIds(roleIds),
      this.permissionsRepository.findUserEntityPermissions(roleIds),
    ]);
    const tree = RouteMapper.buildTree(annotateRoutePermissions(routeRows, permMap));

    this.logger.debug(`User ${caller.userId} retrieved admin routes - found ${routeRows.length} routes`);
    return RouteMapper.buildUserRoutesDto(caller, tree);
  }

  async getStoreRoutes(
    userId: number,
    storeId: number,
  ): Promise<{ routes: ReturnType<typeof RouteMapper.buildTree> }> {
    if (!storeId) {
      return { routes: [] };
    }

    const storeRoles = await this.roleQuery.getActiveRolesForStore(userId, storeId);
    const roleIds = storeRoles.map((r) => r.roleId);

    RoutesValidator.assertStoreAccess(roleIds);

    const [routeRows, permMap] = await Promise.all([
      this.permissionsRepository.findCustomRoleRoutes(roleIds),
      this.permissionsRepository.findUserEntityPermissions(roleIds),
    ]);
    const tree = RouteMapper.buildTree(annotateRoutePermissions(routeRows, permMap));

    this.logger.debug(`User ${userId} retrieved store ${storeId} routes - found ${routeRows.length} routes`);
    return { routes: tree };
  }

  async getStoreRoutesByGuuid(
    user: SessionUser,
    storeGuuid: string,
  ): Promise<StoreRoutesResponseDto> {
    const store = await this.permissionsRepository.findStoreByGuuid(storeGuuid);

    if (!store) {
      this.logger.warn(`Store with guuid ${storeGuuid} not found`);
      return RouteMapper.buildStoreRoutesDto(user, []);
    }

    const { routes } = await this.getStoreRoutes(user.userId, store.id);
    return RouteMapper.buildStoreRoutesDto(user, routes);
  }
}
