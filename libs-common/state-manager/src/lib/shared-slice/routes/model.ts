import type { APIState } from "@nks/shared-types";

export interface Route {
  id: number;
  routePath: string;
  routeName: string;
  description?: string | null;
  iconName?: string | null;
  routeType: string;
  fullPath?: string;
  sortOrder?: number;
  parentRouteFk?: number | null;
}

export interface Permission {
  id: number;
  code: string;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface RoutesState {
  routes: Route[];
  permissions: Permission[];
  isSynced: boolean;
  fetchedAt: number;
  error: string | null;
  fetchState: APIState;
}
