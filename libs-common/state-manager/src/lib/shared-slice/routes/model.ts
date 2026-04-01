import type { APIState } from "@nks/shared-types";

export interface Route {
  id: number;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: "screen" | "sidebar" | "tab" | "modal";
  appCode: string | null;
  isPublic: boolean;
  fullPath: string;
  sortOrder: number;
  parentRouteFk: number | null;
  hasAccess: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  children: Route[];
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
  permissionsLoaded: boolean; // Flag to prevent re-fetching on page refresh
}
