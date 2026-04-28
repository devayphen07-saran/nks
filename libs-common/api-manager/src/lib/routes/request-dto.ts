// ─── Route Response ────────────────────────────────────────────────────────

export interface RouteResponse {
  guuid: string;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: "sidebar" | "tab" | "screen" | "modal";
  routeScope: "admin" | "store";
  isPublic: boolean;
  isHidden: boolean;
  parentRouteGuuid?: string | null;
  fullPath: string;
  sortOrder: number | null;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  children: RouteResponse[];
}

export interface RouteUserSummary {
  guuid: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  primaryRole: string | null;
}

export interface AdminRoutesResponse {
  user: RouteUserSummary;
  routes: RouteResponse[];
}

export interface StoreRoutesResponse {
  user: RouteUserSummary;
  routes: RouteResponse[];
}
