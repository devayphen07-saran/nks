/**
 * Routes Module Type Definitions
 * Shared types used across routes service, mapper, and controller
 */

/**
 * Partial route from database
 * Used internally for building route trees before mapping to DTOs
 */
export type PartialRoute = {
  id: number;           // internal — used only for tree construction
  guuid: string;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: 'sidebar' | 'tab' | 'screen' | 'modal';
  routeScope: 'admin' | 'store';
  isPublic: boolean;
  isHidden: boolean;
  enable: boolean;
  parentRouteFk: number | null;  // internal — used only for tree construction
  fullPath: string;
  sortOrder: number | null;
  entityTypeFk: number | null;
  defaultAction: string | null;
  /** Mirrors entity_type.default_allow — true means VIEW is granted without an explicit role_permissions row. Null when no entity is bound. */
  defaultAllow: boolean | null;
  hasAccess?: boolean;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
};
