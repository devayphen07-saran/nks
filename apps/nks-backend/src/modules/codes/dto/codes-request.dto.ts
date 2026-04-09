import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

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
  storeId: z.number().int().optional(),
});

export const UpdateCodeValueSchema = z.object({
  label: z.string().min(1).max(50).optional(),
  description: z.string().max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export const GetCodeValuesQuerySchema = z.object({
  storeId: z.coerce.number().int().positive().optional(),
});

export class CreateCodeCategoryDto extends createZodDto(CreateCodeCategorySchema) {}
export class CreateCodeValueDto extends createZodDto(CreateCodeValueSchema) {}
export class UpdateCodeValueDto extends createZodDto(UpdateCodeValueSchema) {}
export class GetCodeValuesQueryDto extends createZodDto(GetCodeValuesQuerySchema) {}
