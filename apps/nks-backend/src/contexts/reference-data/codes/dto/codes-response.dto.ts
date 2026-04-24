import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CodeCategoryResponseSchema = z.object({
  guuid: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});

export const CodeValueResponseSchema = z.object({
  guuid: z.string(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  isSystem: z.boolean(),
  storeGuuid: z.string().nullable(),
});

export class CodeCategoryResponseDto extends createZodDto(CodeCategoryResponseSchema) {}
export class CodeValueResponseDto extends createZodDto(CodeValueResponseSchema) {}
