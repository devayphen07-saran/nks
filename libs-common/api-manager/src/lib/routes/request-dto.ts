import type { ApiResponse } from "@nks/shared-types";

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface FetchRoutesRequest {
  // GET request - no body needed
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

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

export interface RoutesAndPermissionsData {
  routes: Route[];
  permissions: Permission[];
}

export type RoutesAndPermissionsResponse = ApiResponse<RoutesAndPermissionsData>;
