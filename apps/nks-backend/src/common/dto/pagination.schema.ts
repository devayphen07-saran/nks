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
 * search is trimmed and must be at least 2 chars (prevents single-char full-table ILIKE scans).
 *
 * Override pageSize in your schema for different max/default:
 * - Small data (reference tables): max 100, default 20
 * - Medium data (codes, lookups): max 200, default 50
 * - Large data (audit logs): max 500, default 50
 * - Sync (cursor-based): max 500, default 200
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
