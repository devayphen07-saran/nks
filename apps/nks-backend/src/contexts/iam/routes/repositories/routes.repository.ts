import { Injectable } from '@nestjs/common';
import { isNull, asc, eq, and, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { InjectDb } from '../../../../core/database/inject-db.decorator';
import { BaseRepository } from '../../../../core/database/base.repository';
import * as schema from '../../../../core/database/schema';
import { SystemRoleCodes } from '../../../../common/constants/system-role-codes.constant';
import type { PartialRoute } from '../dto/routes.interface';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class RoutesRepository extends BaseRepository {
  constructor(@InjectDb() db: Db) { super(db); }

  async findStoreByGuuid(guuid: string): Promise<{ id: number } | null> {
    const [store] = await this.db
      .select({ id: schema.store.id })
      .from(schema.store)
      .where(
        and(
          eq(schema.store.guuid, guuid),
          eq(schema.store.isActive, true),
          isNull(schema.store.deletedAt),
        ),
      )
      .limit(1);

    return store ?? null;
  }

  async findAdminRoutesByRoleIds(roleIds: number[]): Promise<PartialRoute[]> {
    return this.db
      .selectDistinctOn([schema.routes.id], {
        id: schema.routes.id,
        guuid: schema.routes.guuid,
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
    const [ownerRole] = await this.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.code, SystemRoleCodes.STORE_OWNER),
          isNull(schema.roles.storeFk),
          isNull(schema.roles.deletedAt),
        ),
      )
      .limit(1);

    if (!ownerRole) return [];
    return this.findCustomRoleRoutes([ownerRole.id]);
  }

  async findCustomRoleRoutes(roleIds: number[]): Promise<PartialRoute[]> {
    return this.db
      .selectDistinctOn([schema.routes.id], {
        id: schema.routes.id,
        guuid: schema.routes.guuid,
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
