import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { isNull, asc, eq, and } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { RouteMapper, PermissionMapper } from './mapper/route.mapper';

@Injectable()
export class RoutesService {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Returns only the routes assigned to the SUPER_ADMIN role.
   * Filters out soft-deleted routes and deduplicates by routePath.
   */
  async getAdminRoutes() {
    return this.db
      .selectDistinctOn([schema.routes.routePath], {
        id: schema.routes.id,
        routePath: schema.routes.routePath,
        routeName: schema.routes.routeName,
        description: schema.routes.description,
        iconName: schema.routes.iconName,
        routeType: schema.routes.routeType,
        appCode: schema.routes.appCode,
        isPublic: schema.routes.isPublic,
        parentRouteFk: schema.routes.parentRouteFk,
        fullPath: schema.routes.fullPath,
        sortOrder: schema.routes.sortOrder,
      })
      .from(schema.routes)
      .innerJoin(
        schema.roleRouteMapping,
        eq(schema.roleRouteMapping.routeFk, schema.routes.id),
      )
      .innerJoin(
        schema.roles,
        eq(schema.roles.id, schema.roleRouteMapping.roleFk),
      )
      .where(
        and(
          eq(schema.roles.code, 'SUPER_ADMIN'),
          isNull(schema.routes.deletedAt),           // exclude soft-deleted
          eq(schema.roleRouteMapping.allow, true),   // respect explicit deny
        ),
      )
      .orderBy(asc(schema.routes.routePath), asc(schema.routes.sortOrder));
  }

  /**
   * Returns all non-deleted system permissions, ordered by resource then action.
   */
  async getAdminPermissions() {
    return this.db
      .select({
        id: schema.permissions.id,
        code: schema.permissions.code,
        name: schema.permissions.name,
        resource: schema.permissions.resource,
        action: schema.permissions.action,
        description: schema.permissions.description,
      })
      .from(schema.permissions)
      .where(isNull(schema.permissions.deletedAt))
      .orderBy(asc(schema.permissions.resource), asc(schema.permissions.action));
  }

  /**
   * Combined payload used by the admin portal on startup.
   */
  async getAdminRoutesAndPermissions() {
    const [routes, permissions] = await Promise.all([
      this.getAdminRoutes(),
      this.getAdminPermissions(),
    ]);

    return {
      routes: RouteMapper.toResponseDtos(routes),
      permissions: PermissionMapper.toResponseObjects(permissions),
    };
  }
}
