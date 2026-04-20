import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SyncChangesQuerySchema = z.object({
  /**
   * Compound cursor: "timestampMs:rowId" (e.g. "1713500000000:42").
   * Use "0:0" for initial sync. Breaks ties when two rows share the same updated_at.
   */
  cursor: z.string().default('0:0'),
  storeId: z.string().uuid('storeId must be a valid UUID'),
  /** Comma-separated list of tables to sync (e.g. "state,district"). Defaults to all tables. */
  tables: z.string().default('state,district'),
  /** Max rows per page (1–500). Defaults to 200. */
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export class SyncChangesQueryDto extends createZodDto(SyncChangesQuerySchema) {}
