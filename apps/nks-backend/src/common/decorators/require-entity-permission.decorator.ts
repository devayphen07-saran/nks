import { SetMetadata } from '@nestjs/common';

/**
 * Lowercase action code passed to @RequireEntityPermission.
 *
 * The four system actions ('view'|'create'|'edit'|'delete') are the common
 * case. Extended actions seeded in permission_action ('export', 'approve',
 * 'archive', …) are accepted as plain strings — use the PermissionActions
 * constants from entity-codes.constants.ts for type-safe references.
 *
 * PermissionEvaluatorService uppercases this value when querying the
 * role_permissions table, so 'export' → looks up action code 'EXPORT'.
 */
export type EntityPermissionAction = 'view' | 'create' | 'edit' | 'delete' | (string & {});

/**
 * Scope of the permission check.
 *
 *  - 'STORE'    (default): evaluate against the user's store-scoped roles
 *                          (roles whose storeFk === user.activeStoreId).
 *  - 'PLATFORM':           evaluate against the user's platform roles
 *                          (roles whose storeFk IS NULL — system roles).
 */
export type EntityPermissionScope = 'STORE' | 'PLATFORM';

export interface EntityPermissionRequirement {
  /**
   * Static entity code — any string that exists in the `entity_type` DB table.
   * Use `EntityCodes.XXX` constants for known platform entities (autocomplete),
   * or a plain string literal for business-domain entities ('INVOICE', 'PRODUCT').
   * Validated at runtime by RBACGuard against the DB-loaded entity registry.
   * Mutually exclusive with `routeParam`.
   */
  entityCode?: string;
  /**
   * Dynamic entity code — read from a named URL route parameter at runtime.
   * Use when one endpoint handles multiple entity types depending on the URL.
   * Example: @RequireEntityPermission({ routeParam: 'entityCode', action: 'edit' })
   *   POST /entity-status/:entityCode → checks <entityCode>.edit at runtime.
   * Validated against the DB-loaded entity registry — unknown codes yield 400.
   * Mutually exclusive with `entityCode`.
   */
  routeParam?: string;
  action: EntityPermissionAction;
  /** Defaults to 'STORE'. */
  scope?: EntityPermissionScope;
}

export const REQUIRE_ENTITY_PERMISSION_KEY = 'requireEntityPermission';

/**
 * Decorator for granular entity-based permission checks.
 *
 * Static store-scoped usage (default):
 *   @RequireEntityPermission({ entityCode: EntityCodes.INVOICE, action: 'create' })
 *
 * Platform-scoped usage (admin surfaces):
 *   @RequireEntityPermission({
 *     entityCode: EntityCodes.AUDIT_LOG,
 *     action: 'view',
 *     scope: 'PLATFORM',
 *   })
 *
 * Dynamic usage (entity resolved from URL param at runtime):
 *   @RequireEntityPermission({ routeParam: 'entityCode', action: 'edit' })
 *   // POST /entity-status/INVOICE → checks INVOICE.edit
 *   // POST /entity-status/PRODUCT → checks PRODUCT.edit
 */
export const RequireEntityPermission = (
  requirement: EntityPermissionRequirement,
) => SetMetadata(REQUIRE_ENTITY_PERMISSION_KEY, requirement);
