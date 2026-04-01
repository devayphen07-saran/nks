import type { RouteTreeDto } from '../dto/route-response.dto';

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
  // Optional — Drizzle sql<boolean> aliases are not inferred in return types
  hasAccess?: boolean;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
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
  static toRouteTreeNode(route: PartialRoute): RouteTreeDto {
    return {
      id: route.id,
      routePath: route.routePath,
      routeName: route.routeName,
      description: route.description ?? null,
      iconName: route.iconName ?? null,
      routeType: route.routeType,
      appCode: route.appCode ?? null,
      isPublic: route.isPublic,
      parentRouteFk: route.parentRouteFk ?? null,
      fullPath: route.fullPath,
      sortOrder: route.sortOrder ?? 0,
      hasAccess: route.hasAccess ?? false,
      canView: route.canView ?? false,
      canCreate: route.canCreate ?? false,
      canEdit: route.canEdit ?? false,
      canDelete: route.canDelete ?? false,
      canExport: route.canExport ?? false,
      children: [],
    };
  }

  /**
   * Converts a flat list of routes into a recursive tree using parentRouteFk.
   * Nodes with no matching parent are placed at the root level.
   */
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

    // Sort children by sortOrder at every level (mirrors Java buildRouteHierarchy)
    for (const node of nodeMap.values()) {
      node.children.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    roots.sort((a, b) => a.sortOrder - b.sortOrder);

    // Cascade hasAccess=false from parent to children.
    // If a parent route is inaccessible, its children are orphaned in the UI
    // regardless of their own access flag — mark them false for consistency.
    this.cascadeNoAccess(roots);

    return roots;
  }

  /**
   * Recursively propagates hasAccess=false from parent to all descendants.
   * A child that has its own access but whose parent is inaccessible would
   * be orphaned in the UI — mark it false for consistency.
   */
  private static cascadeNoAccess(nodes: RouteTreeDto[]): void {
    for (const node of nodes) {
      if (!node.hasAccess) {
        this.setNoAccessRecursive(node.children);
      } else {
        this.cascadeNoAccess(node.children);
      }
    }
  }

  private static setNoAccessRecursive(nodes: RouteTreeDto[]): void {
    for (const node of nodes) {
      node.hasAccess = false;
      node.canView = false;
      node.canCreate = false;
      node.canEdit = false;
      node.canDelete = false;
      node.canExport = false;
      this.setNoAccessRecursive(node.children);
    }
  }

  /** @deprecated Use buildTree() instead */
  static toResponseDtos(routes: PartialRoute[]): RouteTreeDto[] {
    return this.buildTree(routes);
  }
}

export class PermissionMapper {
  static toResponseObject(permission: PartialPermission) {
    return {
      id: permission.id,
      code: permission.code,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
      description: permission.description ?? null,
    };
  }

  static toResponseObjects(permissions: PartialPermission[]) {
    return permissions.map((p) => this.toResponseObject(p));
  }
}
