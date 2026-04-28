// ── Request ────────────────────────────────────────────────────────────────────

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

// ── Response ───────────────────────────────────────────────────────────────────

export interface UserItem {
  guuid: string;
  iamUserId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  primaryLoginMethod: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  profileCompleted: boolean;
  isActive: boolean;
  createdAt: string;
  primaryRole: string | null;
}

export interface UsersListResponse {
  data: UserItem[];
  message: string;
}
