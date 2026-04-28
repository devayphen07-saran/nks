import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

// ─── Request DTOs ──────────────────────────────────────────────────────────────

// pageSize max 200 (larger lookup lists), search min 2 (stricter guard)
export const GetLookupValuesQuerySchema = searchableSchema.extend({
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  search:   z.string().trim().min(2).max(100).optional(),
  sortBy: z.enum(['code', 'label', 'sortOrder', 'createdAt']).default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});

export class GetLookupValuesQueryDto extends createZodDto(GetLookupValuesQuerySchema) {}

export const CreateLookupValueSchema = z.object({
  code:        z.string().min(1).max(50).toUpperCase(),
  label:       z.string().min(1).max(100),
  description: z.string().max(255).optional(),
  sortOrder:   z.number().int().optional(),
});

export const UpdateLookupValueSchema = CreateLookupValueSchema.omit({ code: true }).partial();

export class CreateLookupValueDto extends createZodDto(CreateLookupValueSchema) {}
export class UpdateLookupValueDto extends createZodDto(UpdateLookupValueSchema) {}

// ─── Response ──────────────────────────────────────────────────────────────────

export interface LookupTypeResponse {
  code:       string;
  title:      string;
  isSystem:   boolean;
  valueCount: number;
}

export interface LookupValueAdminResponse {
  guuid:       string;
  code:        string;
  label:       string;
  description: string | null | undefined;
  isActive:    boolean;
  isHidden:    boolean;
  isSystem:    boolean;
  sortOrder:   number | null;
  createdAt:   Date | string;
  updatedAt:   Date | string | null;
}

export type LookupTypesListResponse = LookupTypeResponse[];
export type LookupValuesListResponse = LookupValueAdminResponse[];
