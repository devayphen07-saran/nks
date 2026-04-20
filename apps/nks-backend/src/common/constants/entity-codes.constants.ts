/**
 * Entity Code Constants — compile-time type safety for controllers.
 *
 * The `entity_type` DB table is the source of truth (seeded via migration 028).
 * These constants MUST match the DB rows — they exist only because decorators
 * like @RequireEntityPermission() run at compile time and can't read from DB.
 *
 * The admin web reads entity_type table dynamically via GET /entity-types
 * to render the role permission matrix — no frontend deploy needed for new entities.
 *
 * When adding a new entity:
 * 1. Add the code here in EntityCodes
 * 2. Add a matching INSERT to the seed migration (or create a new migration)
 * 3. Use @RequireEntityPermission({ entityCode: EntityCodes.XXX, action: ... }) in controller
 *
 * @example
 *   @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.CREATE })
 *   async createStatus() {}
 */

// ─── Entity Codes ────────────────────────────────────────────────────────────
// Must match rows in entity_type table (seeded by migration 028).

export const EntityCodes = {
  // Platform administration
  CODE_CATEGORY: 'CODE_CATEGORY',
  CODE_VALUE: 'CODE_VALUE',
  STATUS: 'STATUS',
  LOOKUP: 'LOOKUP',
  AUDIT_LOG: 'AUDIT_LOG',
  USER: 'USER',

  // Store-scoped
  ROLE: 'ROLE',
  ROUTE: 'ROUTE',

  // Sync
  SYNC: 'SYNC',
} as const;
// NOTE: Business domain codes (INVOICE, PRODUCT, CUSTOMER, etc.) are NOT
// listed here — they exist only in the entity_type DB table. The @RequireEntityPermission
// routeParam option resolves them at runtime; the DB query is the source of truth.

export type EntityCode = (typeof EntityCodes)[keyof typeof EntityCodes];

// ─── Permission Actions ──────────────────────────────────────────────────────

export const PermissionActions = {
  CREATE: 'create',
  VIEW: 'view',
  EDIT: 'edit',
  DELETE: 'delete',
} as const;

export type PermissionAction = (typeof PermissionActions)[keyof typeof PermissionActions];
