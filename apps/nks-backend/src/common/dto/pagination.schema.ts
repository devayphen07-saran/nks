import { z } from 'zod';

/**
 * Base pagination schema — page + pageSize only.
 * Extend this when you need pagination without search
 * or when you need a custom pageSize max/default.
 *
 * Default: page=1, pageSize=20 (max 100)
 */
export const paginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Pagination + optional text search.
 * search is trimmed and must be at least 1 char (prevents empty-string scans).
 *
 * Override search in your own schema for stricter min (e.g. min(2)).
 * Override pageSize for a different max/default.
 */
export const searchableSchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SearchableQuery = z.infer<typeof searchableSchema>;
