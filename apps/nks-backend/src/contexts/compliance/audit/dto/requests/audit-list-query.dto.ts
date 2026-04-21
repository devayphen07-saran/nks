import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { paginationSchema } from '../../../../../common/dto/pagination.schema';

// pageSize max 500 (audit logs can be large); no search — uses typed filters instead
export const AuditListQuerySchema = paginationSchema.extend({
  pageSize:   z.coerce.number().int().min(1).max(500).default(50),
  userId:     z.coerce.number().int().positive().optional(),
  storeId:    z.coerce.number().int().positive().optional(),
  action:     z.string().min(1).optional(),
  entityType: z.string().min(1).optional(),
  isSuccess:  z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  fromDate:   z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  toDate:     z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
});

export class AuditListQueryDto extends createZodDto(AuditListQuerySchema) {}

export type AuditListQuery = z.infer<typeof AuditListQuerySchema>;
