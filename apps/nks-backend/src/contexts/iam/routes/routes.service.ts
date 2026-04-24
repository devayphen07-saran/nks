import { Injectable, Logger } from '@nestjs/common';
import { RouteMapper } from './mapper/route.mapper';
import { RolesService } from '../roles/roles.service';
import { RoutesRepository } from './repositories/routes.repository';
import { RoutesValidator } from './validators';
import type { UserRoutesResponseDto, StoreRoutesResponseDto } from './dto/route-response.dto';
import type { SessionUser } from '../auth/interfaces/session-user.interface';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    private readonly rolesService: RolesService,
    private readonly routesRepository: RoutesRepository,
  ) {}

  async getAdminRoutes(caller: SessionUser): Promise<UserRoutesResponseDto> {
    const userRoles = await this.rolesService.listUserRoles(caller.userId);
    const roleIds = userRoles.map((r) => r.roleId);

    if (roleIds.length === 0) {
      return RouteMapper.buildUserRoutesDto(caller, []);
    }

    const routeRows = await this.routesRepository.findAdminRoutesByRoleIds(roleIds);
    const tree = RouteMapper.buildTree(routeRows);

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

    const isOwner = await this.rolesService.isStoreOwner(userId, storeId);

    if (isOwner) {
      const routeRows = await this.routesRepository.findOwnerRoutes();
      const tree = RouteMapper.buildTree(routeRows);
      this.logger.debug(`Store owner ${userId} retrieved ${storeId} routes - found ${routeRows.length} routes`);
      return { routes: tree };
    }

    const storeRoles = await this.rolesService.getActiveRolesForStore(userId, storeId);
    const roleIds = storeRoles.map((r) => r.roleId);

    RoutesValidator.assertStoreAccess(roleIds);

    const routeRows = await this.routesRepository.findCustomRoleRoutes(roleIds);
    const tree = RouteMapper.buildTree(routeRows);

    this.logger.debug(`User ${userId} retrieved store ${storeId} routes via custom roles - found ${routeRows.length} routes`);
    return { routes: tree };
  }

  async getStoreRoutesByGuuid(
    user: SessionUser,
    storeGuuid: string,
  ): Promise<StoreRoutesResponseDto> {
    const store = await this.routesRepository.findStoreByGuuid(storeGuuid);

    if (!store) {
      this.logger.warn(`Store with guuid ${storeGuuid} not found`);
      return RouteMapper.buildStoreRoutesDto(user, []);
    }

    const { routes } = await this.getStoreRoutes(user.userId, store.id);
    return RouteMapper.buildStoreRoutesDto(user, routes);
  }
}
