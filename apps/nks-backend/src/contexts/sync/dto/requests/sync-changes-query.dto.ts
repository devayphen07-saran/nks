import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Compound cursor value: "timestampMs:rowId" (e.g. "1713500000000:42").
 * "0:0" means initial sync — return all rows for that table.
 */
const cursorValue = z.string().regex(/^\d+:\d+$/).default('0:0');

export const SyncChangesQuerySchema = z.object({
  storeGuuid: z.string().uuid('storeGuuid must be a valid UUID'),
  /** Comma-separated list of tables to sync (e.g. "state,district"). Defaults to all tables. */
  tables: z.string().default('state,district'),
  /** Max rows per page (1–500). Defaults to 200. */
  limit: z.coerce.number().int().min(1).max(500).default(200),
  /**
   * Per-table cursors: cursor[state]=ts:id&cursor[district]=ts:id
   * Falls back to "0:0" for any table not present in this map.
   * Replaces the old single global `cursor` param to eliminate over-fetch
   * when some tables are fully synced and others are not.
   */
  cursor: z.record(z.string(), cursorValue).default({}),
});

export class SyncChangesQueryDto extends createZodDto(SyncChangesQuerySchema) {}
