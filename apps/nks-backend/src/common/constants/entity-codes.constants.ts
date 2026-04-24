/**
 * Entity Code Constants — developer convenience, NOT the source of truth.
 *
 * The `entity_type` DB table is the authoritative registry. These constants
 * are optional shortcuts for known platform entities so controllers get IDE
 * autocomplete and grep-ability. They are NOT type-enforced — any string that
 * exists in `entity_type.code` is a valid entity code at runtime.
 *
 * RBACGuard validates entity codes against a DB-loaded registry on every
 * request. Unknown codes are rejected with ENTITY_CODE_UNKNOWN (400) so
 * misconfigured decorators fail fast with a clear error instead of silently
 * returning 403.
 *
 * Adding a new entity:
 *   1. INSERT into entity_type (via migration or POST /admin/entity-types).
 *   2. Optionally add the code below for IDE autocomplete.
 *   3. Use @RequireEntityPermission({ entityCode: 'MY_ENTITY', action: 'view' })
 *      — a plain string literal is fine; no redeploy of constants needed.
 *
 * @example  static (known entity):
 *   @RequireEntityPermission({ entityCode: EntityCodes.STATUS, action: PermissionActions.CREATE })
 *
 * @example  dynamic (entity code from URL param — resolves at runtime):
 *   @RequireEntityPermission({ routeParam: 'entityCode', action: 'edit' })
 */

// ─── Entity Codes ────────────────────────────────────────────────────────────
// Platform entities seeded by migration 028.
// Business-domain codes (INVOICE, PRODUCT, …) live only in entity_type — add
// them here only if you want IDE autocomplete; they work without being listed.

export const EntityCodes = {
  // Platform administration
  CODE_CATEGORY:  'CODE_CATEGORY',
  CODE_VALUE:     'CODE_VALUE',
  STATUS:         'STATUS',
  LOOKUP:         'LOOKUP',
  AUDIT_LOG:      'AUDIT_LOG',
  USER:           'USER',
  ENTITY_STATUS:  'ENTITY_STATUS',

  // Store-scoped
  ROLE:   'ROLE',
  ROUTE:  'ROUTE',

  // Sync
  SYNC: 'SYNC',
} as const;

/**
 * `EntityCode` is intentionally widened to `string`.
 *
 * The narrow union `(typeof EntityCodes)[keyof typeof EntityCodes]` was
 * removed because it forced every new entity to be added here before it
 * could be used in a decorator — creating a redeploy requirement for a
 * DB-driven registry. The DB is the source of truth; TypeScript is not.
 *
 * Keep using `EntityCodes.XXX` constants where they exist — they give
 * autocomplete and make grep easier. For new entities, plain string
 * literals work fine: `entityCode: 'MY_NEW_ENTITY'`.
 */
export type EntityCode = string;

// ─── Permission Actions ──────────────────────────────────────────────────────
//
// Values are lowercase strings used in @RequireEntityPermission decorators.
// The DB stores UPPERCASE codes ('VIEW', 'CREATE', …) in permission_action.
// PermissionEvaluatorService uppercases at lookup time — decorator call-sites
// never need to change when new actions are added.

export const PermissionActions = {
  // ─── System actions (seeded by migration 032, cannot be removed) ──────────
  CREATE: 'create',
  VIEW:   'view',
  EDIT:   'edit',
  DELETE: 'delete',

  // ─── Extended actions (seeded by migration 032) ───────────────────────────
  EXPORT:  'export',
  APPROVE: 'approve',
  ARCHIVE: 'archive',
} as const;

// Strict union of the four system actions — use where only core CRUD is valid.
export type SystemPermissionAction = 'view' | 'create' | 'edit' | 'delete';

// Open type — accepts any action code registered in the permission_action table.
export type PermissionAction = string;
