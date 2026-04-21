/**
 * Routes Module Type Definitions
 * Shared types used across routes service, mapper, and controller
 */

/**
 * Partial route from database
 * Used internally for building route trees before mapping to DTOs
 */
export type PartialRoute = {
  id: number;
  routePath: string;
  routeName: string;
  description: string | null;
  iconName: string | null;
  routeType: 'sidebar' | 'tab' | 'screen' | 'modal';
  routeScope: 'admin' | 'store';
  isPublic: boolean;
  isHidden: boolean;
  parentRouteFk: number | null;
  fullPath: string;
  sortOrder: number | null;
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
};
