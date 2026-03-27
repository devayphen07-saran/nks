/**
 * Typed representation of the authenticated user attached to `request.user`
 * by AuthGuard after token validation.
 *
 * ID fields:
 *   `id`     → string  — numeric PK as string (e.g. "1")
 *   `userId` → number  — numeric PK, use this for all DB queries
 *   `guuid`  → string  — public-safe UUID, use for external references
 */
export interface SessionUser {
  id: string;
  userId: number;
  guuid: string;

  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;

  kycLevel: number;
  languagePreference: string;
  whatsappOptedIn: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  loginCount: number;
}

export type SessionUserKey = keyof SessionUser;
