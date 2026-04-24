import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { searchableSchema } from '../../../../common/dto/pagination.schema';

export const CreateCodeCategorySchema = z.object({
  code: z.string().min(1).max(30),
  name: z.string().min(1).max(50),
  description: z.string().max(150).optional(),
});

export const CreateCodeValueSchema = z.object({
  code: z.string().min(1).max(30),
  label: z.string().min(1).max(50),
  description: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
  storeGuuid: z.uuid().optional(),
});

export const UpdateCodeValueSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  description: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
});

// categories: standard page=1, pageSize=20 max 100
// Phase 1: Added sortBy and isActive filters
export const GetCodeCategoriesQuerySchema = searchableSchema.extend({
  sortBy: z.enum(['name', 'code', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});

// values: larger pageSize (max 200, default 50) + optional storeId scope
// Phase 1: Added sortBy and isActive filters
export const GetCodeValuesQuerySchema = searchableSchema.extend({
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  storeGuuid: z.string().optional(),
  sortBy: z.enum(['code', 'label', 'sortOrder', 'createdAt']).default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  isActive: z.coerce.boolean().optional(),
});

export class CreateCodeCategoryDto extends createZodDto(CreateCodeCategorySchema) {}
export class CreateCodeValueDto extends createZodDto(CreateCodeValueSchema) {}
export class UpdateCodeValueDto extends createZodDto(UpdateCodeValueSchema) {}
export class GetCodeCategoriesQueryDto extends createZodDto(GetCodeCategoriesQuerySchema) {}
export class GetCodeValuesQueryDto extends createZodDto(GetCodeValuesQuerySchema) {}
