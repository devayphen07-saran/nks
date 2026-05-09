import { z } from 'zod';
import { MAX_PUSH_BATCH, MAX_PUSH_BYTES } from '../sync.constants';

/**
 * Push request schema (Zod validation).
 *
 * Mobile sends:
 * - device_id: stable device UUID (for audit, must match X-Device-Id header)
 * - operations: array of sync operations (max 50, total 500 KB)
 */
export const PushRequestSchema = z.object({
  device_id: z.string().min(1, 'device_id is required'),
  operations: z
    .array(
      z.object({
        client_op_id: z.string().uuid('client_op_id must be UUID'),
        sequence: z
          .number()
          .int('sequence must be integer')
          .positive('sequence must be positive'),
        entity: z.string().min(1, 'entity is required'),
        operation: z.enum(['create', 'update', 'delete']),
        client_id: z.string().uuid('client_id must be UUID'),
        payload: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1, 'operations must have at least 1 item')
    .max(MAX_PUSH_BATCH, `operations must have at most ${MAX_PUSH_BATCH} items`),
});

export type PushRequest = z.infer<typeof PushRequestSchema>;

/**
 * Check push request size (500 KB limit).
 *
 * Called before parsing to reject oversized requests early.
 *
 * @param contentLength - Content-Length header (bytes)
 * @throws BadRequestException if exceeds MAX_PUSH_BYTES
 */
export function checkPushRequestSize(contentLength: number | undefined): void {
  if (!contentLength) {
    return; // No size info, let validation fail later if needed
  }

  if (contentLength > MAX_PUSH_BYTES) {
    throw new Error(
      `Request too large: ${contentLength} bytes (max ${MAX_PUSH_BYTES})`,
    );
  }
}
