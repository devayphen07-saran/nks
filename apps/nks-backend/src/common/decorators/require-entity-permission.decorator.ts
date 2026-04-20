import { SetMetadata } from '@nestjs/common';

export type EntityPermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface EntityPermissionRequirement {
  /**
   * Static entity code — hardcoded in the decorator.
   * Use when the endpoint always protects one specific resource type.
   * Mutually exclusive with `routeParam`.
   */
  entityCode?: string;
  /**
   * Dynamic entity code — read from a URL route parameter at runtime.
   * Use when the endpoint operates on behalf of different resource types
   * depending on the URL (e.g. /entity-status/:entityCode).
   * The DB query validates the resolved value — unknown codes yield 403.
   * Mutually exclusive with `entityCode`.
   */
  routeParam?: string;
  action: EntityPermissionAction;
}

export const REQUIRE_ENTITY_PERMISSION_KEY = 'requireEntityPermission';

/**
 * Decorator for granular entity-based permission checks.
 *
 * Static usage (hardcoded entity):
 *   @RequireEntityPermission({ entityCode: EntityCodes.INVOICE, action: 'create' })
 *
 * Dynamic usage (entity resolved from URL param at runtime):
 *   @RequireEntityPermission({ routeParam: 'entityCode', action: 'edit' })
 *   // POST /entity-status/INVOICE → checks INVOICE.edit
 *   // POST /entity-status/PRODUCT → checks PRODUCT.edit
 */
export const RequireEntityPermission = (
  requirement: EntityPermissionRequirement,
) => SetMetadata(REQUIRE_ENTITY_PERMISSION_KEY, requirement);
