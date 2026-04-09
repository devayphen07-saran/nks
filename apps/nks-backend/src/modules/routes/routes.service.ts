import { Injectable, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { isNull, asc, eq, and, inArray, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { RouteMapper } from './mapper/route.mapper';
import { RolesRepository } from '../roles/roles.repository';
import { RoutesRepository } from './repositories/routes.repository';
import type { PartialRoute } from './routes.types';

@Injectable()
export class RoutesService {
  private readonly logger = new Logger(RoutesService.name);

  constructor(
    @InjectDb() private readonly db: NodePgDatabase<typeof schema>,
    private readonly rolesRepository: RolesRepository,
    private readonly routesRepository: RoutesRepository,
  ) {}

  // ─── Admin Routes (SUPER_ADMIN only) ───────────────────────────────────────

  /**
   * Returns only the admin routes the given user has access to, as a tree.
   * Only users with SUPER_ADMIN role in admin route mappings get routes.
   */
  async getAdminRoutes(
    userId: number,
  ): Promise<{ routes: ReturnType<typeof RouteMapper.buildTree> }> {
    const userRoles = await this.rolesRepository.findUserRoles(userId);
    const roleIds = userRoles.map((r) => r.roleId);

    if (roleIds.length === 0) {
      return { routes: [] };
    }

    const routeRows =
      await this.routesRepository.findAdminRoutesByRoleIds(roleIds);
    const tree = RouteMapper.buildTree(routeRows);

    this.logger.debug(
      `User ${userId} retrieved admin routes - found ${routeRows.length} routes`,
    );
    return { routes: tree };
  }

  // ─── Store Routes (Store owner + Custom roles) ──────────────────────────────

  /**
   * Returns only the store routes the given user has access to in the given store, as a tree.
   * - Store owner (ownerUserFk) → all store routes (full CRUD).
   * - Custom roles → routes and permissions defined in role_route_mapping.
   */
  async getStoreRoutes(
    userId: number,
    storeId: number,
  ): Promise<{ routes: ReturnType<typeof RouteMapper.buildTree> }> {
    if (!storeId) {
      return { routes: [] };
    }

    // Check if user is the store owner
    const isOwner = await this.rolesRepository.isStoreOwner(userId, storeId);

    // If store owner, return all store routes with full permissions
    if (isOwner) {
      const routeRows = await this.routesRepository.findOwnerRoutes();
      const tree = RouteMapper.buildTree(routeRows);

      this.logger.debug(
        `Store owner ${userId} retrieved ${storeId} routes - found ${routeRows.length} routes`,
      );
      return { routes: tree };
    }

    // Get user's custom roles in this store
    const storeRoles = await this.rolesRepository.getActiveRolesForStore(
      userId,
      storeId,
    );
    const roleIds = storeRoles.map((r) => r.roleId);

    // No roles and not owner → no access
    if (roleIds.length === 0) {
      return { routes: [] };
    }

    // For custom roles, get routes based on role_route_mapping
    const routeRows = await this.routesRepository.findCustomRoleRoutes(roleIds);
    const tree = RouteMapper.buildTree(routeRows);

    this.logger.debug(
      `User ${userId} retrieved store ${storeId} routes via custom roles - found ${routeRows.length} routes`,
    );
    return { routes: tree };
  }

  /**
   * Resolves store guuid → numeric storeId, then returns store routes.
   * Returns empty routes if no store with that guuid exists.
   */
  async getStoreRoutesByGuuid(
    userId: number,
    storeGuuid: string,
  ): Promise<{ routes: ReturnType<typeof RouteMapper.buildTree> }> {
    const store = await this.routesRepository.findStoreByGuuid(storeGuuid);

    if (!store) {
      this.logger.warn(`Store with guuid ${storeGuuid} not found`);
      return { routes: [] };
    }

    return this.getStoreRoutes(userId, store.id);
  }

  // ─── Private Query Builders ────────────────────────────────────────────────

  /**
   * Build admin route rows for given role IDs.
   * Queries routes with role permissions from role_route_mapping.
   */
  private async buildAdminRouteRows(
    roleIds: number[],
  ): Promise<PartialRoute[]> {
    return this.db
      .selectDistinctOn([schema.routes.id], {
        id: schema.routes.id,
        routePath: schema.routes.routePath,
        routeName: schema.routes.routeName,
        description: schema.routes.description,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
        isPublic: schema.routes.isPublic,
        isHidden: schema.routes.isHidden,
        parentRouteFk: schema.routes.parentRouteFk,
        fullPath: schema.routes.fullPath,
        sortOrder: schema.routes.sortOrder,
        canView: schema.roleRouteMapping.canView,
        canCreate: schema.roleRouteMapping.canCreate,
        canEdit: schema.roleRouteMapping.canEdit,
        canDelete: schema.roleRouteMapping.canDelete,
        canExport: schema.roleRouteMapping.canExport,
      })
      .from(schema.routes)
      .innerJoin(
        schema.roleRouteMapping,
        and(
          eq(schema.roleRouteMapping.routeFk, schema.routes.id),
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      )
      .where(
        and(
          isNull(schema.routes.deletedAt),
          eq(schema.routes.routeScope, 'admin'),
        ),
      )
      .orderBy(asc(schema.routes.id), asc(schema.routes.sortOrder));
  }

  /**
   * Build store route rows for store owner (all routes with full permissions).
   */
  private async buildOwnerRouteRows(): Promise<PartialRoute[]> {
    return this.db
      .select({
        id: schema.routes.id,
        routePath: schema.routes.routePath,
        routeName: schema.routes.routeName,
        description: schema.routes.description,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
        isPublic: schema.routes.isPublic,
        isHidden: schema.routes.isHidden,
        parentRouteFk: schema.routes.parentRouteFk,
        fullPath: schema.routes.fullPath,
        sortOrder: schema.routes.sortOrder,
        canView: sql<boolean>`true`,
        canCreate: sql<boolean>`true`,
        canEdit: sql<boolean>`true`,
        canDelete: sql<boolean>`true`,
        canExport: sql<boolean>`true`,
      })
      .from(schema.routes)
      .where(
        and(
          isNull(schema.routes.deletedAt),
          eq(schema.routes.routeScope, 'store'),
        ),
      )
      .orderBy(asc(schema.routes.sortOrder));
  }

  /**
   * Build store route rows for custom roles (based on role_route_mapping).
   */
  private async buildCustomRoleRouteRows(
    roleIds: number[],
  ): Promise<PartialRoute[]> {
    return this.db
      .selectDistinctOn([schema.routes.id], {
        id: schema.routes.id,
        routePath: schema.routes.routePath,
        routeName: schema.routes.routeName,
        description: schema.routes.description,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        routeScope: schema.routes.routeScope,
        isPublic: schema.routes.isPublic,
        isHidden: schema.routes.isHidden,
        parentRouteFk: schema.routes.parentRouteFk,
        fullPath: schema.routes.fullPath,
        sortOrder: schema.routes.sortOrder,
        canView: schema.roleRouteMapping.canView,
        canCreate: schema.roleRouteMapping.canCreate,
        canEdit: schema.roleRouteMapping.canEdit,
        canDelete: schema.roleRouteMapping.canDelete,
        canExport: schema.roleRouteMapping.canExport,
      })
      .from(schema.routes)
      .innerJoin(
        schema.roleRouteMapping,
        and(
          eq(schema.roleRouteMapping.routeFk, schema.routes.id),
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      )
      .where(
        and(
          isNull(schema.routes.deletedAt),
          eq(schema.routes.routeScope, 'store'),
        ),
      )
      .orderBy(asc(schema.routes.id), asc(schema.routes.sortOrder));
  }
}
