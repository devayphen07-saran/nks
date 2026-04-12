import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ─── User Response Schema ──────────────────────────────────────────────────

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
  isSuperAdmin: z.boolean(),
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
  user: AuthUserSchema,
  session: AuthSessionSchema,
  access: AuthAccessSchema,
  offlineToken: z.string().optional(),
});

// ─── Exported DTOs ────────────────────────────────────────────────────────

export class AuthResponseDto extends createZodDto(AuthDataSchema) {}
export class MeResponseDto extends createZodDto(AuthUserSchema) {}
export class RefreshTokenResponseDto extends createZodDto(AuthSessionSchema) {}

/**
 * Full auth response envelope returned by the mapper.
 * Flat structure: metadata + auth fields at the same level.
 */
export interface AuthResponseEnvelope {
  requestId: string;
  traceId: string;
  apiVersion: string;
  timestamp: string;
  user: z.infer<typeof AuthUserSchema>;
  session: z.infer<typeof AuthSessionSchema>;
  access: z.infer<typeof AuthAccessSchema>;
  offlineToken?: string;
}
