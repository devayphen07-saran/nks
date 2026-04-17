import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SyncChangesQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative().default(0),
  storeId: z.string().min(1, 'storeId is required'),
  /** Comma-separated list of tables to sync (e.g. "state,district"). Defaults to all tables. */
  tables: z.string().default('state,district'),
  /** Max rows per page (1–500). Defaults to 200. */
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export class SyncChangesQueryDto extends createZodDto(SyncChangesQuerySchema) {}
