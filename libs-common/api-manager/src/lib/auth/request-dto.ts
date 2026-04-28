// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface SendOtpRequest {
  phone: string;
}

export interface VerifyOtpRequest {
  phone: string;
  otp: string;
  reqId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface AuthUserResponse {
  guuid: string;
  iamUserId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
}

export interface AuthTokenResponse {
  sessionId: string;
  /** Populated for mobile clients (X-Device-Type: ANDROID|IOS); null for web. */
  sessionToken: string | null;
  tokenType: 'Bearer';
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  accessToken?: string;
}

export interface AuthContextResponse {
  defaultStoreGuuid: string | null;
}

export interface AuthSyncResponse {
  cursor: string;
  lastSyncedAt: string | null;
  deviceId: string | null;
}

export interface AuthOfflineResponse {
  token: string;
  sessionSignature?: string;
}

/** @deprecated Renamed to AuthTokenResponse — update imports */
export type AuthSessionResponse = AuthTokenResponse;

export interface UserRoleEntry {
  /** Role code from the roles table — fully DB-driven, not a fixed set. */
  roleCode: string;
  storeId: number | null;
  storeGuuid: string | null;
  storeName: string | null;
  isPrimary: boolean;
  assignedAt: string;
  expiresAt: string | null;
}

export interface RouteEntry {
  id: number;
  routeName: string;
  routePath: string;
  description: string | null;
  fullPath: string;
  iconName: string | null;
  routeType: "screen" | "sidebar" | "tab" | "modal";
  routeScope: "admin" | "store";
  isPublic: boolean;
  isHidden: boolean;
  parentRouteFk: number | null;
  sortOrder: number;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  children: RouteEntry[];
}

export interface AuthAccessResponse {
  isSuperAdmin: boolean;
  activeStoreId: number | null;
  roles: UserRoleEntry[];
}

export interface StoreAccessResponse {
  activeStoreId: number;
  roles: UserRoleEntry[];
  permissions: string[];
  routes: RouteEntry[];
}

export interface FeatureFlagsResponse {
  [key: string]: boolean;
}

export interface ApiMetadataResponse {
  requestId: string;
  traceId: string;
  apiVersion: string;
  status?: "success" | "error" | "partial";
  timestamp: string;
}

export interface AuthResponse {
  user: AuthUserResponse;
  auth: AuthTokenResponse;
  context: AuthContextResponse;
  sync: AuthSyncResponse;
  offline: AuthOfflineResponse | null;
}

/** Alias kept for backward compatibility with shared libs that imported AuthData. */
export type AuthData = AuthResponse;

// ─── Profile Completion (unified endpoint for all profile updates) ─────────────

export interface ProfileCompleteRequest {
  name: string; // Update user name
  email?: string; // Add/update email (requires password)
  phoneNumber?: string; // Add/update phone (triggers OTP verification)
  password?: string; // Set/update password (min 8 chars, required when adding email)
}

export interface ProfileCompleteResponse {
  emailVerificationSent: boolean;
  phoneVerificationSent: boolean;
  nextStep: "verifyEmail" | "verifyPhone" | "complete";
  message: string;
}

// ─── Store Selection ────────────────────────────────────────────────────────

export interface StoreSelectRequest {
  storeId: number;
}

export interface StoreSelectResponse {
  data: {
    access: AuthAccessResponse;
    permissions: string[];
    routes: RouteEntry[];
  };
}

// ─── Session Management ────────────────────────────────────────────────────

export interface SessionEntry {
  sessionId: string;
  deviceName: string;
  deviceType: "mobile" | "web" | "tablet" | "desktop";
  lastActivityAt: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string;
}

export type SessionListResponse = SessionEntry[];

// ─── Permissions ──────────────────────────────────────────────────────────

export interface EntityPermission {
  entityCode: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export interface PermissionsSnapshot {
  version: string;
  snapshot: Record<string, EntityPermission>;
}

export interface PermissionsDelta {
  version: string;
  added: Record<string, EntityPermission>;
  removed: string[];
  modified: Record<string, EntityPermission>;
}
