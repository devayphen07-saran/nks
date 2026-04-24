import { ilike, or, sql, SQL } from 'drizzle-orm';

type IlikeCol = Parameters<typeof ilike>[0];

/**
 * Returns `or(ilike(col1, '%term%'), ilike(col2, '%term%'), ...)` when search
 * has a non-empty trimmed value, otherwise `undefined` (safe to spread into `and()`).
 *
 * @example
 * const where = and(
 *   isNull(t.deletedAt),
 *   ilikeAny(search, t.name, t.code),
 * );
 */
export function ilikeAny(search: string | undefined, ...cols: IlikeCol[]): SQL | undefined {
  const term = search?.trim();
  if (!term) return undefined;
  return or(...cols.map((col) => ilike(col, `%${term}%`)));
}

/**
 * Returns `(firstNameCol || ' ' || lastNameCol) ILIKE '%term%'` when search
 * has a non-empty trimmed value, otherwise `undefined` (safe to spread into `and()`).
 * Use alongside `ilikeAny` to match full-name queries like "John Doe".
 *
 * @example
 * const where = and(
 *   isNull(t.deletedAt),
 *   or(ilikeAny(search, t.firstName, t.email), ilikeFullName(search, t.firstName, t.lastName)),
 * );
 */
export function ilikeFullName(
  search: string | undefined,
  firstNameCol: IlikeCol,
  lastNameCol: IlikeCol,
): SQL | undefined {
  const term = search?.trim();
  if (!term) return undefined;
  return sql`(${firstNameCol} || ' ' || ${lastNameCol}) ILIKE ${`%${term}%`}`;
}
