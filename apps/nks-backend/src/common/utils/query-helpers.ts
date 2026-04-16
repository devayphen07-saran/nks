import { and, isNull, SQL } from 'drizzle-orm';

/**
 * Returns a condition that filters only non-deleted (active) rows.
 * Use in .where() to exclude soft-deleted records.
 *
 * @example
 * .where(whereActive(schema.users))
 */
export function whereActive(table: { deletedAt: unknown }): SQL {
  return isNull(table.deletedAt as Parameters<typeof isNull>[0]);
}

/**
 * Returns a condition that combines soft-delete check with additional conditions.
 * Equivalent to: AND(deletedAt IS NULL, ...conditions)
 *
 * @example
 * .where(whereActiveAnd(schema.users, eq(schema.users.email, email)))
 */
export function whereActiveAnd(
  table: { deletedAt: unknown },
  ...conditions: SQL[]
): SQL {
  return and(isNull(table.deletedAt as Parameters<typeof isNull>[0]), ...conditions) as SQL;
}
