import type { RouteTreeDto, UserRoutesResponseDto, StoreRoutesResponseDto } from '../dto/route-response.dto';
import type { PartialRoute } from '../dto/routes.interface';
import type { SessionUser } from '../../auth/interfaces/session-user.interface';

export class RouteMapper {
  static buildRouteTreeNode(route: PartialRoute, parentGuuid: string | null): RouteTreeDto {
    return {
      guuid: route.guuid,
      routePath: route.routePath,
      routeName: route.routeName,
      description: route.description ?? null,
      iconName: route.iconName ?? null,
      routeType: route.routeType,
      routeScope: route.routeScope,
      isPublic: route.isPublic,
      isHidden: route.isHidden,
      parentRouteGuuid: parentGuuid,
      fullPath: route.fullPath,
      sortOrder: route.sortOrder ?? 0,
      hasAccess: route.hasAccess ?? true,
      children: [],
    };
  }

  static buildTree(routes: PartialRoute[]): RouteTreeDto[] {
    // Build id→guuid map first so we can resolve parentRouteGuuid
    const idToGuuid = new Map<number, string>();
    for (const route of routes) {
      idToGuuid.set(route.id, route.guuid);
    }

    const nodeMap = new Map<number, RouteTreeDto>();
    const roots: RouteTreeDto[] = [];

    for (const route of routes) {
      const parentGuuid = route.parentRouteFk ? (idToGuuid.get(route.parentRouteFk) ?? null) : null;
      nodeMap.set(route.id, this.buildRouteTreeNode(route, parentGuuid));
    }

    for (const route of routes) {
      const node = nodeMap.get(route.id)!;
      if (route.parentRouteFk) {
        const parent = nodeMap.get(route.parentRouteFk);
        if (parent) {
          parent.children.push(node);
        }
        // Parent absent from result set (filtered out by role mapping or deleted).
        // Drop the child rather than promoting it to root — a dangling child at
        // root level would leak a route into the wrong scope/hierarchy position.
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

  static buildUserRoutesDto(
    user: SessionUser,
    routes: RouteTreeDto[],
  ): UserRoutesResponseDto {
    return {
      user: {
        guuid: user.guuid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        primaryRole: user.primaryRole,
      },
      routes,
    };
  }

  static buildStoreRoutesDto(
    user: SessionUser,
    routes: RouteTreeDto[],
  ): StoreRoutesResponseDto {
    return {
      user: {
        guuid: user.guuid,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        primaryRole: user.primaryRole,
      },
      routes,
    };
  }
}
