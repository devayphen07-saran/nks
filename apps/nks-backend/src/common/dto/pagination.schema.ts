import { z } from 'zod';

/**
 * Hard ceiling on pageSize across the API. No endpoint should ever exceed
 * this — runaway pageSize causes OOM, slow queries, and unbounded payloads.
 *
 * If a use case genuinely needs more, prefer cursor-based pagination
 * over raising this number.
 */
export const PAGE_SIZE_HARD_LIMIT = 500;

/**
 * Standard pageSize column with the hard ceiling applied.
 * Pass `max` to tighten further per endpoint (default 100).
 */
export function pageSizeColumn(opts: { max?: number; default?: number } = {}) {
  const max = Math.min(opts.max ?? 100, PAGE_SIZE_HARD_LIMIT);
  const def = Math.min(opts.default ?? 20, max);
  return z.coerce.number().int().positive().max(max).default(def);
}

/**
 * Base pagination schema — page + pageSize only.
 * Extend this when you need pagination without search
 * or when you need a custom pageSize max/default.
 *
 * Default: page=1, pageSize=20 (max 100, hard ceiling 500)
 */
export const paginationSchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: pageSizeColumn(),
});

/**
 * Pagination + optional text search.
 * search is trimmed and must be at least 2 chars (prevents single-char full-table ILIKE scans).
 *
 * Override pageSize via `pageSizeColumn({ max, default })` for different limits.
 * Hard ceiling of {@link PAGE_SIZE_HARD_LIMIT} applies regardless.
 */
export const searchableSchema = paginationSchema.extend({
  search: z.string().trim().min(2).max(100).optional(),
});

/**
 * Phase 1 Essential Filters — Add these to ALL list endpoints
 * - sortBy: Allow consumers to control result ordering
 * - isActive: Filter deleted records (soft deletes via deletedAt IS NULL)
 *
 * USAGE: Extend your schema with these helpers:
 *   GetMyResourcesQuerySchema = searchableSchema.extend(sortBySchema).extend(filterActiveSchema)
 */
export const sortBySchema = z.object({
  sortBy: z.string().optional(), // Each endpoint defines allowed values via .refine() or enum
});

export const sortOrderSchema = z.object({
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const filterActiveSchema = z.object({
  isActive: z.coerce.boolean().optional(), // true=only active, false=only inactive, undefined=all
});

export type PaginationQuery = z.infer<typeof paginationSchema>;
export type SearchableQuery = z.infer<typeof searchableSchema>;
export type SortByQuery = z.infer<typeof sortBySchema>;
export type SortOrderQuery = z.infer<typeof sortOrderSchema>;
export type FilterActiveQuery = z.infer<typeof filterActiveSchema>;
