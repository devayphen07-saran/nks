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
   * Required cross-service user identifier used as a URL path parameter.
   */
  iamUserId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phoneNumber: z.string().nullable(),
});

// ─── Auth Token Schema ─────────────────────────────────────────────────────
// Auth model: opaque session token + DB validation. No JWT in the request
// pipeline — the bearer token is a 64-char hex string looked up in the DB on
// every authenticated request. Short-lived JWTs are not used for API auth.

const AuthTokenSchema = z.object({
  sessionId: z.string(),
  /**
   * Opaque bearer credential (BetterAuth session token).
   * Mobile: send as `Authorization: Bearer <bearerToken>` on every API request.
   * Web: always null — delivered via httpOnly cookie; never appears in JS scope.
   */
  bearerToken: z.string().nullable(),
  /** Bearer session expiry — use this to decide when to call POST /auth/refresh-token. */
  sessionExpiresAt: z.string(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.string(),
});

// ─── Offline Schema (mobile-only) ─────────────────────────────────────────
// Present only when X-Device-Type: ANDROID | IOS. Always null for web clients.
// The offline token's expiry is embedded as `exp` in the JWT payload (3-day TTL)
// — decode `offline.token` to read it. Validity is independent of session expiry.

const AuthOfflineSchema = z.object({
  /** RS256 JWT with 3-day TTL — used as authorization proof while offline. Expiry is in the JWT `exp` claim. */
  token: z.string(),
  /**
   * HMAC-SHA256 signature over (userId, storeId, roles[], offlineValidUntil).
   * Computed server-side with OFFLINE_SESSION_HMAC_SECRET.
   * Mobile stores this as-is; cannot regenerate it. Full verification happens
   * server-side on every sync push.
   */
  sessionSignature: z.string(),
});

// ─── Context Schema ────────────────────────────────────────────────────────

const AuthContextSchema = z.object({
  /** null if user has no store role or no default store set. */
  defaultStoreGuuid: z.string().nullable(),
  /**
   * Internal numeric id of the default store. Mobile uses this as the local
   * SQLite primary key when initializing offline data. null when guuid is null.
   */
  defaultStoreId: z.number().nullable(),
});

// ─── Exported DTOs ────────────────────────────────────────────────────────

export class MeResponseDto extends createZodDto(AuthUserSchema) {}

/**
 * Full auth response envelope returned by the mapper.
 * Optimized for payload size — API metadata fields (requestId, traceId, apiVersion,
 * timestamp) and profile fields (emailVerified, phoneNumberVerified, image) removed.
 * isSuperAdmin removed — clients derive it from roles.some(r => r.roleCode === 'SUPER_ADMIN').
 * Full user profile is available via GET /auth/me.
 */
export interface AuthResponseEnvelope {
  user: z.infer<typeof AuthMinimalUserSchema>;
  auth: z.infer<typeof AuthTokenSchema>;
  /** Store/tenant context for the active session. */
  context: z.infer<typeof AuthContextSchema>;
  /** Present for mobile clients; always null for web (no offline capability). */
  offline: z.infer<typeof AuthOfflineSchema> | null;
}
