import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

/**
 * Forward-compatibility contract (within a given x-sync-schema-version):
 *
 *   - **Server tolerates extra fields** in `opData`. `z.record()` accepts any
 *     keys; the per-handler Zod schema (in BaseSyncHandler) parses out the
 *     fields it knows and silently ignores the rest.
 *   - **Server tolerates missing optional fields**. Handler schemas mark
 *     newly-added fields `.optional()` for one release window before making
 *     them required, so older clients that don't yet send them keep working.
 *   - **Breaking changes increment x-sync-schema-version.** When the contract
 *     becomes incompatible with old clients (renamed required fields, removed
 *     fields, semantic changes), bump SUPPORTED_SYNC_SCHEMA_VERSIONS in
 *     sync.constants.ts. Old clients receive `409 Conflict` and must upgrade.
 *
 * The above means a v1 server safely accepts a v1 mobile build that adds new
 * optional fields, and a v1 mobile build safely talks to a v1 server that
 * adds new fields to the response — without coordinating deploys.
 */
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
