import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

/**
 * Shared query schema for location list endpoints that support optional text search.
 * min(2) guard prevents full-table ilike scans on a single keystroke.
 *
 * Phase 1 Essential Filters:
 * - sortBy: Order by name, code, or createdAt
 * - isActive: Filter active (true), inactive (false), or all (undefined)
 */
export const LocationSearchQuerySchema = searchableSchema.extend({
  sortBy: z.enum(['name', 'code', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});

export class LocationSearchQueryDto extends createZodDto(LocationSearchQuerySchema) {}

/**
 * Query schema for pincodes — adds pagination on top of search.
 * A single district (e.g. Mumbai) can have 400+ pincodes; returning all unbounded
 * risks OOM and slow responses, so page/pageSize are required here.
 *
 * Phase 1 Essential Filters:
 * - sortBy: Order by code, area, or createdAt
 * - isActive: Filter active/inactive/all
 */
export const PincodeQuerySchema = searchableSchema.extend({
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search:   z.string().trim().min(2).max(100).optional(),
  sortBy: z.enum(['code', 'area', 'createdAt']).default('code'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});

export class PincodeQueryDto extends createZodDto(PincodeQuerySchema) {}

/**
 * State code param — validates 2-letter uppercase state code (e.g., 'KA', 'MH').
 */
export const StateCodeParamSchema = z.object({
  code: z.string().regex(/^[A-Z]{2}$/, 'State code must be exactly 2 uppercase letters'),
});

export class StateCodeParamDto extends createZodDto(StateCodeParamSchema) {}

/**
 * Pincode param — validates 6-digit numeric pincode.
 */
export const PincodeParamSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});

export class PincodeParamDto extends createZodDto(PincodeParamSchema) {}

/**
 * District guuid param — validates UUID for district lookup.
 */
export const DistrictGuuidParamSchema = z.object({
  districtGuuid: z.uuid({ error: 'districtGuuid must be a valid UUID' }),
});

export class DistrictGuuidParamDto extends createZodDto(DistrictGuuidParamSchema) {}
