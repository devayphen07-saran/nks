/**
 * System Role Code Constants — compile-time safe references for privilege checks.
 *
 * Only roles that appear in application logic (guards, token building) are defined here.
 * All other roles (STAFF, USER, MANAGER, CASHIER…) live in the DB only — no code
 * constant is needed for roles that never trigger a bypass or a special code path.
 *
 * The `roles` DB table is the source of truth for the full role list.
 */
export const SystemRoleCodes = {
  /** Platform super-admin — bypasses all entity permission checks in guards. */
  SUPER_ADMIN: 'SUPER_ADMIN',
  /** Default platform user — assigned to every user except the first (SUPER_ADMIN). */
  USER: 'USER',
  /** Store owner — assigned when a user creates a store. Store-scoped. */
  STORE_OWNER: 'STORE_OWNER',
} as const;

export type SystemRoleCode = (typeof SystemRoleCodes)[keyof typeof SystemRoleCodes];
