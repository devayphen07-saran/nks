import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SyncOperationSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  table: z.string().min(1),
  op: z.enum(['create', 'update', 'delete']),
  opData: z.record(z.string(), z.unknown()),
  // SHA-256(sessionSignature + ":" + op + ":" + table + ":" + JSON.stringify(opData))
  // computed on-device to detect payload tampering during offline queue storage.
  signature: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
});

// Optional offline session context submitted by mobile clients that pushed
// mutations while offline. When present the server re-validates the HMAC
// to detect any tampering of userId / storeId / roles on-device.
export const OfflineSessionContextSchema = z.object({
  userGuuid: z.string().uuid(),
  storeGuuid: z.string().nullable(),
  roles: z.array(z.string().min(1)),
  offlineValidUntil: z.number().int().positive(),
  signature: z.string().regex(/^[0-9a-f]{64}$/i, 'Invalid HMAC signature format'),
  // Stable device identifier — used to check against revoked_devices table.
  // Optional for backward compatibility with older client versions.
  deviceId: z.string().max(255).optional(),
  // RS256 offline JWT issued at login — verified server-side to close the write-guard gap.
  // When present, SyncService re-verifies the JWT signature + expiry and cross-validates
  // its claims against the HMAC-signed session payload to ensure consistency.
  // Optional for backward compatibility with older client versions.
  offlineToken: z.string().optional(),
}).optional();

export const SyncPushSchema = z.object({
  operations: z.array(SyncOperationSchema).min(1),
  offlineSession: OfflineSessionContextSchema,
});

export class SyncPushDto extends createZodDto(SyncPushSchema) {}

export type SyncOperation = z.infer<typeof SyncOperationSchema>;
export type OfflineSessionContext = z.infer<typeof OfflineSessionContextSchema>;
