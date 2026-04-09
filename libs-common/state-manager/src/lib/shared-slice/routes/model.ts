import type { APIState } from "@nks/shared-types";

export interface Route {
  id: number;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: "screen" | "sidebar" | "tab" | "modal";
  routeScope: "admin" | "store";
  isPublic: boolean;
  isHidden: boolean;
  fullPath: string;
  sortOrder: number;
  parentRouteFk: number | null;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  children: Route[];
}

export interface RouteUser {
  guuid: string;
  name: string;
  email: string;
  primaryRole: string | null;
}

export interface RoutesState {
  user: RouteUser | null;
  routes: Route[];
  isSynced: boolean;
  fetchedAt: number;
  error: string | null;
  fetchState: APIState;
}
