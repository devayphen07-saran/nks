/**
 * Typed representation of the authenticated user attached to `request.user`
 * by AuthGuard after token validation.
 *
 * ID fields:
 *   `id`     → string  — numeric PK as string (e.g. "1")
 *   `userId` → number  — numeric PK, use this for all DB queries
 *   `guuid`  → string  — public-safe UUID, use for external references
 *
 * Role fields (populated per-request from user_role_mapping — always fresh):
 *   `roles`         → role entries from user_role_mapping
 *   `primaryRole`   → primary role code (e.g. "SUPER_ADMIN", "STORE_OWNER")
 *   `isSuperAdmin`  → derived from roles — use for SUPER_ADMIN bypass checks
 *   `activeStoreId` → store the user selected after login (null for global sessions)
 */
export interface SessionUserRole {
  roleCode: string;
  storeId: number | null;
  storeName: string | null;
  isPrimary: boolean;
  assignedAt: string;
  expiresAt: string | null;
}

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
  lastLoginAt: Date | null;

  // Roles — queried live from user_role_mapping on every request
  roles: SessionUserRole[];
  primaryRole: string | null;
  isSuperAdmin: boolean;
  activeStoreId: number | null;
}

export type SessionUserKey = keyof SessionUser;
