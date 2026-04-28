/**
 * System role code constants — shared across mobile and web clients.
 *
 * Only the three platform-level roles that require special code-path handling
 * are defined here. All other roles (MANAGER, CASHIER, STAFF, etc.) are fully
 * DB-driven and never referenced in client code. The `roles` DB table is the
 * source of truth for the full role list.
 *
 * Use these constants for:
 *   - Panel routing (SUPER_ADMIN → admin panel, others → store panel)
 *   - JWT claim checks (selectIsSuperAdmin)
 *   - Conditional UI rendering based on platform vs store scope
 *
 * Never hardcode role code strings as bare literals — import from here.
 */
export const SystemRoleCodes = {
  /** Full platform access. No store scope. Routed to admin panel. */
  SUPER_ADMIN: 'SUPER_ADMIN',
  /** Default role assigned to every new user before store assignment. */
  USER: 'USER',
  /** Store creator role. Assigned when a store is created. Store-scoped. */
  STORE_OWNER: 'STORE_OWNER',
} as const;

export type SystemRoleCode = (typeof SystemRoleCodes)[keyof typeof SystemRoleCodes];
