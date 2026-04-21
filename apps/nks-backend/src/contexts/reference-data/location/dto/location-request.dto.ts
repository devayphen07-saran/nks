import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

/**
 * Shared query schema for location list endpoints that support optional text search.
 * min(2) guard prevents full-table ilike scans on a single keystroke.
 */
export const LocationSearchQuerySchema = z.object({
  search: z.string().min(2).max(100).optional(),
});

export class LocationSearchQueryDto extends createZodDto(LocationSearchQuerySchema) {}

/**
 * Query schema for pincodes — adds pagination on top of search.
 * A single district (e.g. Mumbai) can have 400+ pincodes; returning all unbounded
 * risks OOM and slow responses, so page/pageSize are required here.
 */
export const PincodeQuerySchema = searchableSchema.extend({
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search:   z.string().trim().min(2).max(100).optional(),
});

export class PincodeQueryDto extends createZodDto(PincodeQuerySchema) {}
