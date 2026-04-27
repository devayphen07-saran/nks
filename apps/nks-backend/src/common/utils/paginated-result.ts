import type { PaginationMeta } from './api-response';

/**
 * Typed wrapper for paginated controller responses.
 *
 * Using a class (not an interface) means TransformInterceptor can identify
 * paginated results via `instanceof` — an explicit, standard type check —
 * rather than inspecting a magic `__paginated` flag. No domain object can
 * accidentally satisfy `instanceof PaginatedResult`.
 *
 * Always construct via the `paginated()` factory.
 */
export class PaginatedResult<T> {
  readonly data: T[];
  readonly meta: PaginationMeta;

  constructor(data: T[], meta: PaginationMeta) {
    this.data = data;
    this.meta = meta;
  }
}

export function paginated<T>(opts: {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}): PaginatedResult<T> {
  const { items, page, pageSize, total } = opts;
  if (pageSize <= 0) throw new RangeError('pageSize must be a positive integer');
  return new PaginatedResult(items, {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    hasMore: page * pageSize < total,
  });
}
