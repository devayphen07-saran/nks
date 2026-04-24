import type { PaginationMeta } from './api-response';

/**
 * Discriminated wrapper for paginated controller responses.
 *
 * The `__paginated` brand field lets TransformInterceptor.isPaginatedResult()
 * use a single reliable discriminant instead of duck-typing `{data[], meta}`
 * shape — which would false-positive on any domain object that happens to carry
 * those field names (e.g. SyncDeltaResponse { data: ChangeSet[], meta: {...} }).
 *
 * Always construct via the `paginated()` factory, never by object literal.
 */
export interface PaginatedResult<T> {
  readonly __paginated: true;
  data: T[];
  meta: PaginationMeta;
}

export function paginated<T>(opts: {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}): PaginatedResult<T> {
  const { items, page, pageSize, total } = opts;
  if (pageSize <= 0) throw new RangeError('pageSize must be a positive integer');
  return {
    __paginated: true,
    data: items,
    meta: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    },
  };
}
