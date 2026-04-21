import { ilike, or, SQL } from 'drizzle-orm';

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
