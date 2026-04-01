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

export interface RoutesAndPermissionsData {
  routes: Route[];
  permissions: Permission[];
}

export type RoutesAndPermissionsResponse = ApiResponse<RoutesAndPermissionsData>;
