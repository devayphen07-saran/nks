import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AuditListQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  storeId: z.coerce.number().int().positive().optional(),
  action: z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  isSuccess: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export class AuditListQueryDto extends createZodDto(AuditListQuerySchema) {}

export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;
