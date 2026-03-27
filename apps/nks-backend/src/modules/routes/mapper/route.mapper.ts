import type { RouteResponseDto } from '../dto/route-response.dto';

type PartialRoute = {
  id: number;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: 'sidebar' | 'tab' | 'screen' | 'modal';
  appCode: string | null;
  isPublic: boolean;
  parentRouteFk: number | null;
  fullPath: string;
  sortOrder: number | null;
};

type PartialPermission = {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
};

export class RouteMapper {
  /**
   * Map database Route entity to RouteResponseDto
   */
  static toResponseDto(route: PartialRoute): RouteResponseDto {
    return {
      id: route.id,
      routePath: route.routePath,
      routeName: route.routeName,
      description: route.description || null,
      iconName: route.iconName || null,
      routeType: route.routeType as any,
      appCode: route.appCode || null,
      isPublic: route.isPublic,
      parentRouteFk: route.parentRouteFk || null,
      fullPath: route.fullPath,
      sortOrder: route.sortOrder ?? 0,
    };
  }

  /**
   * Map array of Route entities to RouteResponseDto[]
   */
  static toResponseDtos(routes: PartialRoute[]): RouteResponseDto[] {
    return routes.map((route) => this.toResponseDto(route));
  }
}

export class PermissionMapper {
  /**
   * Map database Permission entity to simple permission response
   */
  static toResponseObject(permission: PartialPermission) {
    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description || null,
    };
  }

  /**
   * Map array of Permission entities to response objects
   */
  static toResponseObjects(permissions: PartialPermission[]) {
    return permissions.map((permission) => this.toResponseObject(permission));
  }
}
