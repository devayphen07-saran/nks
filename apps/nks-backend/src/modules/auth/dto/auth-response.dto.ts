import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── User Response Schema (full — for GET /auth/me) ───────────────────────────

const AuthUserSchema = z.object({
  id: z.string(),
  guuid: z.string(),
  name: z.string().nullable(),
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
  id: z.string(),
  guuid: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});

// ─── Session Response Schema ───────────────────────────────────────────────

const AuthSessionSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
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

// ─── Access Response Schema ───────────────────────────────────────────────

const AuthAccessSchema = z.object({
  activeStoreId: z.number().nullable(),
  roles: z.array(
    z.object({
      roleCode: z.string(),
      storeId: z.number().nullable(),
      storeName: z.string().nullable(),
      isPrimary: z.boolean(),
      assignedAt: z.string(),
      expiresAt: z.string().nullable(),
    }),
  ),
});

// ─── Auth Data Schema (unified response) ──────────────────────────────────

const AuthDataSchema = z.object({
  user: AuthMinimalUserSchema,
  session: AuthSessionSchema,
  access: AuthAccessSchema,
  offlineToken: z.string().optional(),
  offlineSessionSignature: z.string().optional(),
});

// ─── Exported DTOs ────────────────────────────────────────────────────────

export class AuthResponseDto extends createZodDto(AuthDataSchema) {}
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
  access: z.infer<typeof AuthAccessSchema>;
  offlineToken?: string;
  /** HMAC-SHA256 of the offline session payload, signed server-side.
   *  Mobile stores this and checks its presence on load; the signing secret
   *  never leaves the server, so clients cannot forge a new signature.  */
  offlineSessionSignature?: string;
}
