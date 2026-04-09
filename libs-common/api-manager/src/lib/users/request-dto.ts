// ── Request ────────────────────────────────────────────────────────────────────

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

// ── Response ───────────────────────────────────────────────────────────────────

export interface UserItem {
  guuid: string;
  name: string;
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

export interface UsersListData {
  items: UserItem[];
}

export interface UsersListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UsersListResponse {
  data: UsersListData;
  message: string;
  meta: UsersListMeta;
}
