/**
 * Authentication Type Definitions
 * Replaces all 'any' types with proper TypeScript interfaces
 */

// ============================================================================
// SESSION & TOKEN TYPES
// ============================================================================

export interface SessionData {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date | string;
  issuedAt: Date | string;
  lastActivityAt: Date;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'IOS' | 'ANDROID' | 'WEB';
  appVersion?: string;
  ipAddress?: string;
  userAgent?: string;
  activeStoreFk?: number;
  userRoles?: string; // JSON stringified array
  primaryRole?: string;
  roleHash?: string;
  jwtToken?: string;
}

export interface TokenPayload {
  sub: number; // Subject (user ID)
  email: string;
  roles: RoleInfo[];
  activeStore?: number;
  iat: number; // Issued at
  exp: number; // Expiration
  iss: string; // Issuer
}

export interface RefreshTokenPayload {
  sessionId: string;
  userId: number;
  iat: number;
  exp: number;
}

// ============================================================================
// ROLE & PERMISSION TYPES
// ============================================================================

export interface RoleInfo {
  roleId: number;
  roleCode: string;
  storeFk?: number;
  storeName?: string;
}

export interface UserRoleWithStore extends RoleInfo {
  storeId: number;
  storeName: string;
}

export interface PermissionInfo {
  id: number;
  code: string;
  name: string;
  description?: string;
  category?: string;
  resource?: string;
}

export interface RolePermissions {
  roleId: number;
  roleCode: string;
  permissions: PermissionInfo[];
}

export interface UserPermissionContext {
  userId: number;
  roles: RoleInfo[];
  permissions: Record<number, PermissionInfo[]>; // storeId -> permissions
  directPermissions: Record<number, PermissionInfo[]>; // storeId -> direct permissions
  primaryRole: string | null;
  activeStore?: number;
}

// ============================================================================
// DEVICE TRACKING TYPES
// ============================================================================

export interface DeviceInfo {
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'IOS' | 'ANDROID' | 'WEB';
  appVersion?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionWithDevice extends SessionData {
  device: DeviceInfo;
}

// ============================================================================
// AUTHENTICATION RESPONSE TYPES
// ============================================================================

export interface AuthResponse {
  user: UserInfo;
  session: SessionResponse;
  authContext: AuthContext;
  access: AccessControl;
  flags: Record<string, boolean>;
}

export interface UserInfo {
  id: number;
  email: string;
  name: string;
  emailVerified: boolean;
  phoneNumber?: string;
  phoneNumberVerified: boolean;
  image?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
}

export interface SessionResponse {
  sessionId: string;
  tokenType: 'Bearer';
  accessToken: string;
  issuedAt: Date | string;
  expiresAt: Date | string;
  refreshToken: string;
  refreshExpiresAt: Date | string;
  mechanism: 'password' | 'oauth' | 'passkey';
  absoluteExpiry: Date | string;
}

export interface AuthContext {
  method: 'password' | 'oauth' | 'passkey';
  mfaVerified: boolean;
  mfaRequired: boolean;
  trustLevel: 'standard' | 'elevated' | 'high';
  stepUpRequired: boolean;
  lastVerificationAt?: Date;
}

export interface AccessControl {
  isSuperAdmin: boolean;
  activeStoreId: number | null;
  roles: RoleInfo[];
  initialRoute: string;
  permissions?: PermissionInfo[];
}

// ============================================================================
// PASSWORD & VALIDATION TYPES
// ============================================================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: PasswordValidationError[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

export interface PasswordValidationError {
  code:
    | 'TOO_SHORT'
    | 'NO_UPPERCASE'
    | 'NO_LOWERCASE'
    | 'NO_NUMBERS'
    | 'NO_SPECIAL_CHARS';
  message: string;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  specialCharsRegex: RegExp;
}

// ============================================================================
// OTP TYPES
// ============================================================================

export interface OTPVerificationRequest {
  email?: string;
  phoneNumber?: string;
  otp: string;
  type: 'SMS' | 'EMAIL';
}

export interface OTPData {
  id: number;
  userId: number;
  email?: string;
  phoneNumber?: string;
  otp: string; // Should be hashed in production
  otpHash?: string; // For production use
  type: 'SMS' | 'EMAIL';
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  verified: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface TransactionOptions {
  timeout?: number;
  isolationLevel?:
    | 'READ_UNCOMMITTED'
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
}

// ============================================================================
// QUERY FILTER TYPES
// ============================================================================

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'nin';
  value: string | number | boolean | string[] | number[] | null | undefined;
}

export interface WhereCondition {
  [key: string]: string | number | boolean | Date | null | undefined | (string | number)[];
}

export interface QueryOptions {
  filters?: QueryFilter[];
  where?: WhereCondition;
  orderBy?: Record<string, 'asc' | 'desc'>;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}
