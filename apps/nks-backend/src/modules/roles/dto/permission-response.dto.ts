import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PermissionResponseSchema = z.object({
  id: z.number(),
  guuid: z.string(),
  name: z.string(),
  code: z.string(),
  resource: z.string(),
  action: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});

export class PermissionResponseDto extends createZodDto(
  PermissionResponseSchema,
) {}
