import type { RouteTreeDto, UserRoutesResponseDto, StoreRoutesResponseDto } from '../dto/route-response.dto';
import type { PartialRoute } from '../dto/routes.interface';
import type { SessionUser } from '../../auth/interfaces/session-user.interface';

export class RouteMapper {
  static toRouteTreeNode(route: PartialRoute): RouteTreeDto {
    return {
      id: route.id,
      routePath: route.routePath,
      routeName: route.routeName,
      description: route.description ?? null,
      iconName: route.iconName ?? null,
      routeType: route.routeType,
      routeScope: route.routeScope,
      isPublic: route.isPublic,
      isHidden: route.isHidden,
      parentRouteFk: route.parentRouteFk ?? null,
      fullPath: route.fullPath,
      sortOrder: route.sortOrder ?? 0,
      canView: route.canView ?? false,
      canCreate: route.canCreate ?? false,
      canEdit: route.canEdit ?? false,
      canDelete: route.canDelete ?? false,
      canExport: route.canExport ?? false,
      children: [],
    };
  }

  static buildTree(routes: PartialRoute[]): RouteTreeDto[] {
    const nodeMap = new Map<number, RouteTreeDto>();
    const roots: RouteTreeDto[] = [];

    for (const route of routes) {
      nodeMap.set(route.id, this.toRouteTreeNode(route));
    }

    for (const route of routes) {
      const node = nodeMap.get(route.id)!;
      if (route.parentRouteFk && nodeMap.has(route.parentRouteFk)) {
        nodeMap.get(route.parentRouteFk)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    for (const node of nodeMap.values()) {
      node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    roots.sort((a, b) => a.sortOrder - b.sortOrder);

    return roots;
  }

  static toUserRoutesResponse(
    user: SessionUser,
    routes: RouteTreeDto[],
  ): UserRoutesResponseDto {
    return {
      user: {
        guuid: user.guuid,
        name: user.name,
        email: user.email,
        primaryRole: user.primaryRole,
      },
      routes,
    };
  }

  static toStoreRoutesResponse(
    user: SessionUser,
    routes: RouteTreeDto[],
  ): StoreRoutesResponseDto {
    return {
      user: {
        guuid: user.guuid,
        name: user.name,
        email: user.email,
        primaryRole: user.primaryRole,
      },
      routes,
    };
  }
}
