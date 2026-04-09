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
  lastLoginAt: z.string().nullable(),
  lastLoginIp: z.string().nullable(),
});

// ─── Session Response Schema ───────────────────────────────────────────────

const AuthSessionSchema = z.object({
  sessionId: z.string(),
  tokenType: z.string(),
  sessionToken: z
    .string()
    .describe(
      'BetterAuth opaque session token. Usage: (1) WEB: automatically sent via httpOnly cookie for ONLINE API calls; (2) MOBILE: send via Authorization: Bearer header for ONLINE API calls only. Do NOT use for offline JWT verification.',
    ),
  issuedAt: z.string(),
  expiresAt: z.string(),
  refreshToken: z
    .string()
    .describe(
      'Opaque refresh token (30 days). Usage: WEB sends via httpOnly cookie, MOBILE keeps in secure storage and sends in request body for POST /auth/refresh-token.',
    ),
  refreshExpiresAt: z.string(),
  mechanism: z.enum(['password', 'otp', 'oauth', 'token']),
  absoluteExpiry: z.string(),
  defaultStore: z
    .object({
      guuid: z.string(),
    })
    .nullable(),
  jwtToken: z
    .string()
    .optional()
    .describe(
      'RS256 JWT (1-hour expiry). MOBILE ONLY: for OFFLINE JWT verification with JWKS public keys. Contains embedded roles + stores for offline permission checks. Do NOT send this to API as Authorization header.',
    ),
});

// ─── Auth Context Response Schema ──────────────────────────────────────────

const AuthContextSchema = z.object({
  method: z.enum(['password', 'otp', 'oauth']),
  mfaVerified: z.boolean(),
  mfaRequired: z.boolean(),
  trustLevel: z.enum(['standard', 'high', 'unverified']),
  stepUpRequired: z.boolean(),
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

// ─── Feature Flags Response Schema ────────────────────────────────────────

const FeatureFlagsSchema = z.record(z.string(), z.boolean());

// ─── Auth Data Schema (unified response) ──────────────────────────────────

const AuthDataSchema = z.object({
  user: AuthUserSchema,
  session: AuthSessionSchema,
  authContext: AuthContextSchema,
  access: AuthAccessSchema,
  flags: FeatureFlagsSchema,
});

// ─── Exported DTOs ────────────────────────────────────────────────────────
// Note: These are the data payloads that go inside ApiResponse<T>.data
// ApiResponse wraps these with { status, message, data: T }

export class AuthResponseDto extends createZodDto(AuthDataSchema) {}
export class MeResponseDto extends createZodDto(AuthUserSchema) {}
export class RefreshTokenResponseDto extends createZodDto(AuthSessionSchema) {}

/**
 * Full auth response envelope returned by the mapper.
 * Includes metadata (requestId, traceId) + nested AuthData.
 * This is the shape that goes into ApiResponse.ok(result).
 */
export interface AuthResponseEnvelope {
  requestId: string;
  traceId: string;
  apiVersion: string;
  timestamp: string;
  data: {
    user: z.infer<typeof AuthUserSchema>;
    session: z.infer<typeof AuthSessionSchema>;
    authContext: z.infer<typeof AuthContextSchema>;
    access: z.infer<typeof AuthAccessSchema>;
    flags?: Record<string, boolean>;
  };
}
