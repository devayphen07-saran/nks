"use client";

import { getIconFromName } from "./icon-map";
import type { NavItem, NavItemWithChildren } from "./types";

/**
 * Route interface for transformation
 */
export interface Route {
  id?: string | number;
  routePath: string;
  routeName?: string;
  iconName?: string;
  hidden?: boolean;
  hasAccess?: boolean;
  enable?: boolean;
  childMenus?: Route[];
}

export interface TransformRoutesOptions {
  /** Base path to prepend (e.g., "/{tenantId}") */
  basePath: string;
  /** Filter function to exclude routes (defaults to filtering hidden/no-access) */
  filterFn?: (route: Route) => boolean;
}

/**
 * Default filter: exclude hidden routes and routes without access
 */
export const defaultRouteFilter = (route: Route): boolean => {
  return !route.hidden && route.hasAccess !== false && route.enable !== false;
};

/**
 * Transform API routes to NavItemWithChildren for sidebar
 */
export function transformRoutesToNavItems(
  routes: Route[] | undefined,
  options: TransformRoutesOptions
): NavItemWithChildren[] {
  if (!routes) return [];

  const { basePath, filterFn = defaultRouteFilter } = options;

  return routes.filter(filterFn).map((route) => {
    // Build full path for parent
    const parentPath = `/${basePath}/${route.routePath}`.replace(/\/+/g, "/");

    // Transform child menus
    const children = route.childMenus?.filter(filterFn).map((child: Route) => ({
      href: `${parentPath}/${child.routePath}`.replace(/\/+/g, "/"),
      icon: getIconFromName(child.iconName),
      label: child.routeName || "",
      badge: undefined,
    }));

    const hasChildren = children && children.length > 0;

    return {
      id: route.id ?? route.routePath ?? "",
      // Parent items with children don't have href (clicking expands/collapses)
      href: hasChildren ? undefined : parentPath,
      icon: getIconFromName(route.iconName),
      label: route.routeName || "",
      children: hasChildren ? children : undefined,
    };
  });
}

/**
 * Get flat NavItem array for bottom nav (no nesting)
 */
export function getBottomNavItems(
  routes: Route[] | undefined,
  options: TransformRoutesOptions,
  maxItems: number = 5
): NavItem[] {
  if (!routes) return [];

  const { basePath, filterFn = defaultRouteFilter } = options;

  return routes
    .filter(filterFn)
    .filter((route) => !route.childMenus?.length) // Only leaf items (no children)
    .slice(0, maxItems)
    .map((route) => ({
      href: `/${basePath}/${route.routePath}`.replace(/\/+/g, "/"),
      icon: getIconFromName(route.iconName),
      label: route.routeName || "",
    }));
}
