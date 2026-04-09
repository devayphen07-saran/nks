// ─── Route Response ────────────────────────────────────────────────────────

export interface RouteResponse {
  id: number;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: "sidebar" | "tab" | "screen" | "modal";
  routeScope: "admin" | "store";
  isPublic: boolean;
  isHidden: boolean;
  parentRouteFk?: number | null;
  fullPath: string;
  sortOrder: number;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  children: RouteResponse[];
}

export interface RouteUserSummary {
  guuid: string;
  name: string;
  email: string;
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
