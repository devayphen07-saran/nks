import { Injectable } from '@nestjs/common';
import { isNull, asc, eq, and, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../core/database/inject-db.decorator';
import * as schema from '../../../core/database/schema';
import type { PartialRoute } from '../routes.types';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class RoutesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findStoreByGuuid(guuid: string): Promise<{ id: number } | null> {
    const [store] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(eq(schema.store.guuid, guuid))
      .limit(1);

    return store ?? null;
  }

  async findAdminRoutesByRoleIds(roleIds: number[]): Promise<PartialRoute[]> {
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

  async findOwnerRoutes(): Promise<PartialRoute[]> {
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

  async findCustomRoleRoutes(roleIds: number[]): Promise<PartialRoute[]> {
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
