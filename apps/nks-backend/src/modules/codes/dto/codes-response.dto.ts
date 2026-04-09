import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CodeCategoryResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});

export const CodeValueResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  isSystem: z.boolean(),
  storeFk: z.number().nullable(),
});

export class CodeCategoryResponseDto extends createZodDto(CodeCategoryResponseSchema) {}
export class CodeValueResponseDto extends createZodDto(CodeValueResponseSchema) {}
