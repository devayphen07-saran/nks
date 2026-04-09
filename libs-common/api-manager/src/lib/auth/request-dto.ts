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
  name: string;
  email: string;
  password: string;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export interface AuthUserResponse {
  id: string;
  guuid: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  image: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export interface AuthSessionResponse {
  sessionId: string;
  tokenType: string;
  sessionToken: string;
  issuedAt: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  mechanism: "password" | "otp" | "oauth" | "token";
  absoluteExpiry: string;
  defaultStore: { guuid: string } | null;
  jwtToken?: string;
}

export interface AuthContextResponse {
  method: "password" | "otp" | "oauth";
  mfaVerified: boolean;
  mfaRequired: boolean;
  trustLevel: "standard" | "high" | "unverified";
  stepUpRequired: boolean;
}

export interface UserRoleEntry {
  roleCode:
    | "SUPER_ADMIN"
    | "STORE_OWNER"
    | "STAFF"
    | "STORE_MANAGER"
    | "CASHIER"
    | "DELIVERY"
    | "CUSTOMER";
  storeId: number | null;
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

export interface AuthData {
  user: AuthUserResponse;
  session: AuthSessionResponse;
  authContext: AuthContextResponse;
  access: AuthAccessResponse;
  flags: FeatureFlagsResponse;
}

export interface AuthResponse extends ApiMetadataResponse {
  data: AuthData;
}

// ─── Profile Completion (unified endpoint for all profile updates) ─────────────

export interface ProfileCompleteRequest {
  name: string;                    // Update user name
  email?: string;                  // Add/update email (requires password)
  phoneNumber?: string;            // Add/update phone (triggers OTP verification)
  password?: string;               // Set/update password (min 8 chars, required when adding email)
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
