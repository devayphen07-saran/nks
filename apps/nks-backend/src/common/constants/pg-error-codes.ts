/**
 * PostgreSQL error codes — single source of truth.
 * Use these instead of raw string literals when checking pg error codes.
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */

/** 23505 — unique_violation: duplicate key violates a unique constraint */
export const PG_UNIQUE_VIOLATION = '23505' as const;

/** 23503 — foreign_key_violation: referenced row does not exist */
export const PG_FOREIGN_KEY_VIOLATION = '23503' as const;

/** 23502 — not_null_violation: null value in a NOT NULL column */
export const PG_NOT_NULL_VIOLATION = '23502' as const;
