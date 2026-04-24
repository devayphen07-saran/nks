import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── User Response Schema (full — for GET /auth/me) ───────────────────────────

const AuthUserSchema = z.object({
  guuid: z.string(),
  iamUserId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
  phoneNumberVerified: z.boolean(),
  image: z.string().nullable(),
});

// ─── User Response Schema (minimal — for auth responses) ─────────────────────
// Profile fields (emailVerified, phoneNumberVerified, image) are not needed for
// session/token flow. Fetch the full profile via GET /auth/me when required.

const AuthMinimalUserSchema = z.object({
  guuid: z.string(),
  /**
   * Required cross-service user identifier. Consumed by ayphen-frontend,
   * ayphen-next and ayphen-iam as the primary external user ID (used as a
   * URL path parameter in those clients).
   */
  iamUserId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});

// ─── Session Response Schema ───────────────────────────────────────────────

const AuthSessionSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  /**
   * Always 'Bearer' — included so clients can build the Authorization
   * header without relying on a hard-coded convention.
   */
  tokenType: z.literal('Bearer'),
  expiresAt: z.string(),
  refreshToken: z.string(),
  refreshExpiresAt: z.string(),
  defaultStore: z
    .object({
      guuid: z.string(),
    })
    .nullable(),
  jwtToken: z.string().optional(),
});

// ─── Sync Metadata Schema ─────────────────────────────────────────────────
// Seeds the mobile sync engine without an extra round-trip: mobile can call
// GET /sync/changes immediately after login using `cursor` as the starting
// point. `deviceId` echoes the X-Device-Id header so mobile can confirm its
// binding. `lastSyncedAt` is null on fresh login — per-device sync state
// tracking is not yet persisted server-side.

const AuthSyncMetadataSchema = z.object({
  cursor: z.string().describe('Initial sync cursor — "0:0" on fresh login'),
  lastSyncedAt: z.string().nullable().describe('ISO timestamp of last known sync for this device, or null for full sync'),
  deviceId: z.string().nullable().describe('Device identifier echoed from X-Device-Id header; null for web clients'),
});

// ─── Exported DTOs ────────────────────────────────────────────────────────

export class MeResponseDto extends createZodDto(AuthUserSchema) {}
export class RefreshTokenResponseDto extends createZodDto(AuthSessionSchema) {}

/**
 * Full auth response envelope returned by the mapper.
 * Optimized for payload size — API metadata fields (requestId, traceId, apiVersion,
 * timestamp) and profile fields (emailVerified, phoneNumberVerified, image) removed.
 * isSuperAdmin removed — clients derive it from roles.some(r => r.roleCode === 'SUPER_ADMIN').
 * Full user profile is available via GET /auth/me.
 */
export interface AuthResponseEnvelope {
  user: z.infer<typeof AuthMinimalUserSchema>;
  session: z.infer<typeof AuthSessionSchema>;
  sync: z.infer<typeof AuthSyncMetadataSchema>;
  offlineToken?: string;
  /** HMAC-SHA256 of the offline session payload, signed server-side.
   *  Mobile stores this and checks its presence on load; the signing secret
   *  never leaves the server, so clients cannot forge a new signature.  */
  offlineSessionSignature?: string;
}
