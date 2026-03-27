import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RoleResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  roleName: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().nullable(),
  isSystem: z.boolean(),
});

export class RoleResponseDto extends createZodDto(RoleResponseSchema) {}
