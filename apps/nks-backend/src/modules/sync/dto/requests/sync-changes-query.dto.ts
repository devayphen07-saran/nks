import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SyncChangesQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().default(0),
  storeId: z.string().min(1, 'storeId is required'),
});

export class SyncChangesQueryDto extends createZodDto(SyncChangesQuerySchema) {}
