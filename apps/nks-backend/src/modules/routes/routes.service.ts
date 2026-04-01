import { Injectable } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../core/database/schema';
import { isNull, asc, eq, and, inArray, sql } from 'drizzle-orm';
import { InjectDb } from '../../core/database/inject-db.decorator';
import { RouteMapper, PermissionMapper } from './mapper/route.mapper';

@Injectable()
export class RoutesService {
  constructor(@InjectDb() private readonly db: NodePgDatabase<typeof schema>) {}

  /**
   * Get routes for the current user based on their roles.
   * Returns web/dashboard routes for authenticated users.
   */
  async getUserRoutes(userId: number) {
    // Get all active roles for this user
    const userRoles = await this.db
      .select({
        roleId: schema.userRoleMapping.roleFk,
        roleCode: schema.roles.code,
      })
      .from(schema.userRoleMapping)
      .innerJoin(
        schema.roles,
        eq(schema.userRoleMapping.roleFk, schema.roles.id),
      )
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.isActive, true),
          eq(schema.roles.isActive, true),
        ),
      );

    const roleIds = userRoles.map((r) => r.roleId);
    const roleCodes = userRoles.map((r) => r.roleCode);

    // SUPER_ADMIN gets all routes
    if (roleCodes.includes('SUPER_ADMIN')) {
      const routes = await this.getAdminRoutes();
      const permissions = await this.getAdminPermissions();
      return {
        routes: RouteMapper.buildTree(routes),
        permissions: PermissionMapper.toResponseObjects(permissions),
      };
    }

    // For other users, get web routes based on their roles
    if (roleIds.length === 0) return { routes: [], permissions: [] };

    const accessibleRouteIds = this.db
      .select({ routeFk: schema.roleRouteMapping.routeFk })
      .from(schema.roleRouteMapping)
      .where(
        and(
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      );

    const [routeRows, permissionRows] = await Promise.all([
      this.db
        .select({
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
          hasAccess: sql<boolean>`
            CASE WHEN ${schema.routes.id} IN (${accessibleRouteIds}) THEN true ELSE false END
          `.as('hasAccess'),
          canView: sql<boolean>`
            CASE WHEN ${schema.routes.id} IN (${accessibleRouteIds}) THEN true ELSE false END
          `.as('canView'),
          canCreate: sql<boolean>`false`.as('canCreate'),
          canEdit: sql<boolean>`false`.as('canEdit'),
          canDelete: sql<boolean>`false`.as('canDelete'),
          canExport: sql<boolean>`false`.as('canExport'),
        })
        .from(schema.routes)
        .where(
          and(
            isNull(schema.routes.deletedAt),
            eq(schema.routes.appCode, 'NKS_WEB'),
          ),
        )
        .orderBy(asc(schema.routes.sortOrder), asc(schema.routes.routePath)),

      this.db
        .selectDistinct({
          id: schema.permissions.id,
          code: schema.permissions.code,
          name: schema.permissions.name,
          resource: schema.permissions.resource,
          action: schema.permissions.action,
          description: schema.permissions.description,
        })
        .from(schema.rolePermissionMapping)
        .innerJoin(
          schema.permissions,
          eq(schema.rolePermissionMapping.permissionFk, schema.permissions.id),
        )
        .where(inArray(schema.rolePermissionMapping.roleFk, roleIds)),
    ]);

    return {
      routes: RouteMapper.buildTree(routeRows),
      permissions: PermissionMapper.toResponseObjects(permissionRows),
    };
  }

  /**
   * Returns ALL admin routes (appCode = 'NKS_WEB') as a tree.
   * Routes assigned to SUPER_ADMIN role get hasAccess = true; all others false.
   * SUPER_ADMIN always has full CRUD on every route they have access to.
   */
  async getAdminRoutes() {
    // Subquery: route IDs accessible by SUPER_ADMIN
    const superAdminRouteIds = this.db
      .select({ routeFk: schema.roleRouteMapping.routeFk })
      .from(schema.roleRouteMapping)
      .innerJoin(
        schema.roles,
        eq(schema.roles.id, schema.roleRouteMapping.roleFk),
      )
      .where(
        and(
          eq(schema.roles.code, 'SUPER_ADMIN'),
          eq(schema.roleRouteMapping.allow, true),
        ),
      );

    return this.db
      .select({
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
        hasAccess: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('hasAccess'),
        canView: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('canView'),
        canCreate: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('canCreate'),
        canEdit: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('canEdit'),
        canDelete: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('canDelete'),
        canExport: sql<boolean>`
          CASE WHEN ${schema.routes.id} IN (${superAdminRouteIds}) THEN true ELSE false END
        `.as('canExport'),
      })
      .from(schema.routes)
      .where(
        and(
          isNull(schema.routes.deletedAt),
          eq(schema.routes.appCode, 'NKS_WEB'),
        ),
      )
      .orderBy(asc(schema.routes.sortOrder), asc(schema.routes.routePath));
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
      .orderBy(
        asc(schema.permissions.resource),
        asc(schema.permissions.action),
      );
  }

  /**
   * Returns ALL store routes (appCode IS NULL) as a tree with hasAccess per node.
   * hasAccess = true for routes the user's role(s) in the active store can access.
   * Also returns full permission objects granted to those roles.
   */
  async getStoreRoutes(userId: number, sessionToken: string) {
    // Resolve active store from session using userId (token is hashed, can't be used for lookup)
    const [session] = await this.db
      .select({ activeStoreFk: schema.userSession.activeStoreFk })
      .from(schema.userSession)
      .where(eq(schema.userSession.userId, userId))
      .limit(1);

    const activeStoreId = session?.activeStoreFk ?? null;
    if (!activeStoreId) return { routes: [], permissions: [] };

    // Get role IDs for this user in the active store
    const userRoles = await this.db
      .select({ roleId: schema.userRoleMapping.roleFk })
      .from(schema.userRoleMapping)
      .where(
        and(
          eq(schema.userRoleMapping.userFk, userId),
          eq(schema.userRoleMapping.storeFk, activeStoreId),
        ),
      );

    const roleIds = userRoles.map((r) => r.roleId);
    if (roleIds.length === 0) return { routes: [], permissions: [] };

    // Subquery: route IDs the user's roles can access (allow = true)
    const accessibleRouteIds = this.db
      .select({ routeFk: schema.roleRouteMapping.routeFk })
      .from(schema.roleRouteMapping)
      .where(
        and(
          inArray(schema.roleRouteMapping.roleFk, roleIds),
          eq(schema.roleRouteMapping.allow, true),
        ),
      );

    const [routeRows, permissionRows] = await Promise.all([
      this.db
        .select({
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
          hasAccess: sql<boolean>`
            CASE WHEN ${schema.routes.id} IN (${accessibleRouteIds}) THEN true ELSE false END
          `.as('hasAccess'),
          canView: sql<boolean>`
            CASE WHEN ${schema.routes.id} IN (${accessibleRouteIds}) THEN true ELSE false END
          `.as('canView'),
          canCreate: sql<boolean>`
            CASE WHEN EXISTS (
              SELECT 1 FROM ${schema.roleRouteMapping}
              WHERE ${schema.roleRouteMapping.routeFk} = ${schema.routes.id}
                AND ${schema.roleRouteMapping.roleFk} = ANY(${sql.raw(`ARRAY[${roleIds.join(',')}]`)})
                AND ${schema.roleRouteMapping.canCreate} = true
            ) THEN true ELSE false END
          `.as('canCreate'),
          canEdit: sql<boolean>`
            CASE WHEN EXISTS (
              SELECT 1 FROM ${schema.roleRouteMapping}
              WHERE ${schema.roleRouteMapping.routeFk} = ${schema.routes.id}
                AND ${schema.roleRouteMapping.roleFk} = ANY(${sql.raw(`ARRAY[${roleIds.join(',')}]`)})
                AND ${schema.roleRouteMapping.canEdit} = true
            ) THEN true ELSE false END
          `.as('canEdit'),
          canDelete: sql<boolean>`
            CASE WHEN EXISTS (
              SELECT 1 FROM ${schema.roleRouteMapping}
              WHERE ${schema.roleRouteMapping.routeFk} = ${schema.routes.id}
                AND ${schema.roleRouteMapping.roleFk} = ANY(${sql.raw(`ARRAY[${roleIds.join(',')}]`)})
                AND ${schema.roleRouteMapping.canDelete} = true
            ) THEN true ELSE false END
          `.as('canDelete'),
          canExport: sql<boolean>`
            CASE WHEN EXISTS (
              SELECT 1 FROM ${schema.roleRouteMapping}
              WHERE ${schema.roleRouteMapping.routeFk} = ${schema.routes.id}
                AND ${schema.roleRouteMapping.roleFk} = ANY(${sql.raw(`ARRAY[${roleIds.join(',')}]`)})
                AND ${schema.roleRouteMapping.canExport} = true
            ) THEN true ELSE false END
          `.as('canExport'),
        })
        .from(schema.routes)
        .where(
          and(isNull(schema.routes.deletedAt), isNull(schema.routes.appCode)),
        )
        .orderBy(asc(schema.routes.sortOrder), asc(schema.routes.routePath)),

      this.db
        .select({
          id: schema.permissions.id,
          code: schema.permissions.code,
          name: schema.permissions.name,
          resource: schema.permissions.resource,
          action: schema.permissions.action,
          description: schema.permissions.description,
        })
        .from(schema.rolePermissionMapping)
        .innerJoin(
          schema.permissions,
          eq(schema.rolePermissionMapping.permissionFk, schema.permissions.id),
        )
        .where(inArray(schema.rolePermissionMapping.roleFk, roleIds)),
    ]);

    return {
      routes: RouteMapper.buildTree(routeRows),
      permissions: PermissionMapper.toResponseObjects(permissionRows),
    };
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
      routes: RouteMapper.buildTree(routes),
      permissions: PermissionMapper.toResponseObjects(permissions),
    };
  }
}
