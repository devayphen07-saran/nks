import { z } from 'zod';

/**
 * Pull query schema (Zod validation).
 *
 * Mobile sends:
 * - entity: entity type to pull (required)
 * - cursor: pagination cursor from last pull (optional, null = start from beginning)
 * - limit: max rows (1-500, default 500)
 *
 * The cursor is timestamp-based: `<updated_at_ms>:<row_uuid>`. The compound
 * tiebreaker prevents duplicate/skipped rows when many rows share the same
 * `updated_at` — equivalent to a `since=<ISO>` query with stable ordering.
 * Store scoping is enforced server-side via the device context's storeId,
 * not via a query parameter, so a compromised client cannot read another
 * tenant's data by editing the URL.
 */
export const PullQuerySchema = z.object({
  entity: z.string().min(1, 'entity is required'),
  cursor: z
    .string()
    .regex(
      /^\d+:[0-9a-f\-]+$/i,
      'cursor must be in format "<milliseconds>:<uuid>"',
    )
    .optional(),
  limit: z
    .union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
    .pipe(z.number().int('limit must be integer').min(1).max(500))
    .default(500),
});

export type PullQuery = z.infer<typeof PullQuerySchema>;
