/**
 * Application-wide error code constants — single source of truth.
 *
 * Convention:  <DOMAIN>_<ENTITY>_<REASON>
 *
 * HTTP Hint:
 *  400  – BAD_REQUEST  (validation, malformed input)
 *  401  – UNAUTHORIZED (missing / invalid token)
 *  403  – FORBIDDEN    (authenticated but not allowed)
 *  404  – NOT_FOUND    (resource doesn't exist)
 *  409  – CONFLICT     (duplicate / already exists)
 *  422  – UNPROCESSABLE (business-rule violation)
 *  429  – TOO_MANY_REQUESTS (rate limit)
 *  500  – INTERNAL_ERROR
 */

// ─────────────────────────────────────────────────────────────────────────────
// Generic / Shared
// ─────────────────────────────────────────────────────────────────────────────
export const ErrorCode = {
  // General
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',

  // ─── Auth ───────────────────────────────────────────────────────────────────
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_REVOKED: 'AUTH_REFRESH_TOKEN_REVOKED',
  AUTH_SESSION_NOT_FOUND: 'AUTH_SESSION_NOT_FOUND',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_SESSION_CREATE_FAILED: 'AUTH_SESSION_CREATE_FAILED',
  AUTH_SESSION_ROTATION_FAILED: 'AUTH_SESSION_ROTATION_FAILED',
  AUTH_SESSION_COMPROMISED: 'AUTH_SESSION_COMPROMISED',
  AUTH_INVALID_SESSION_TOKEN: 'AUTH_INVALID_SESSION_TOKEN',
  AUTH_INVALID_SESSION_ID: 'AUTH_INVALID_SESSION_ID',
  AUTH_FORBIDDEN_SESSION: 'AUTH_FORBIDDEN_SESSION',
  AUTH_DEVICE_MISMATCH: 'AUTH_DEVICE_MISMATCH',
  AUTH_INVALID_JWT_AUDIENCE: 'AUTH_INVALID_JWT_AUDIENCE',
  AUTH_PROVIDER_NOT_SUPPORTED: 'AUTH_PROVIDER_NOT_SUPPORTED',
  AUTH_OAUTH_STATE_MISMATCH: 'AUTH_OAUTH_STATE_MISMATCH',
  AUTH_PASSWORD_TOO_WEAK: 'AUTH_PASSWORD_TOO_WEAK',
  AUTH_PASSWORD_REQUIRED: 'AUTH_PASSWORD_REQUIRED',
  AUTH_PASSWORD_ALREADY_SET: 'AUTH_PASSWORD_ALREADY_SET',
  AUTH_EMAIL_NOT_SET: 'AUTH_EMAIL_NOT_SET',
  AUTH_INVALID_PHONE: 'AUTH_INVALID_PHONE',
  AUTH_INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
  AUTH_NO_ADMIN_EXISTS: 'AUTH_NO_ADMIN_EXISTS',

  // ─── OTP ────────────────────────────────────────────────────────────────────
  OTP_INVALID: 'OTP_INVALID',
  OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_ALREADY_USED: 'OTP_ALREADY_USED',
  OTP_MAX_ATTEMPTS_EXCEEDED: 'OTP_MAX_ATTEMPTS_EXCEEDED',
  OTP_SEND_FAILED: 'OTP_SEND_FAILED',

  // ─── User ───────────────────────────────────────────────────────────────────
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_EMAIL_ALREADY_EXISTS: 'USER_EMAIL_ALREADY_EXISTS',
  USER_PHONE_ALREADY_EXISTS: 'USER_PHONE_ALREADY_EXISTS',
  USER_PROFILE_INCOMPLETE: 'USER_PROFILE_INCOMPLETE',
  USER_CANNOT_DELETE_SELF: 'USER_CANNOT_DELETE_SELF',
  USER_BLOCKED: 'USER_BLOCKED',
  USER_INACTIVE: 'USER_INACTIVE',
  USER_PASSWORD_MISMATCH: 'USER_PASSWORD_MISMATCH',
  USER_OLD_PASSWORD_INCORRECT: 'USER_OLD_PASSWORD_INCORRECT',

  // ─── Company ────────────────────────────────────────────────────────────────
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  COMPANY_ALREADY_EXISTS: 'COMPANY_ALREADY_EXISTS',
  COMPANY_GSTIN_ALREADY_EXISTS: 'COMPANY_GSTIN_ALREADY_EXISTS',
  COMPANY_PAN_ALREADY_EXISTS: 'COMPANY_PAN_ALREADY_EXISTS',
  COMPANY_USER_ALREADY_MEMBER: 'COMPANY_USER_ALREADY_MEMBER',
  COMPANY_USER_NOT_MEMBER: 'COMPANY_USER_NOT_MEMBER',
  COMPANY_OWNER_CANNOT_BE_REMOVED: 'COMPANY_OWNER_CANNOT_BE_REMOVED',
  COMPANY_INACTIVE: 'COMPANY_INACTIVE',

  // ─── RBAC ───────────────────────────────────────────────────────────────────
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  ROLE_ALREADY_EXISTS: 'ROLE_ALREADY_EXISTS',
  ROLE_IS_SYSTEM: 'ROLE_IS_SYSTEM',
  ROLE_CANNOT_DELETE_SYSTEM: 'ROLE_CANNOT_DELETE_SYSTEM',
  PERMISSION_NOT_FOUND: 'PERMISSION_NOT_FOUND',
  PERMISSION_ALREADY_EXISTS: 'PERMISSION_ALREADY_EXISTS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  ROUTE_ALREADY_EXISTS: 'ROUTE_ALREADY_EXISTS',
  USER_ROLE_MAPPING_NOT_FOUND: 'USER_ROLE_MAPPING_NOT_FOUND',
  USER_ROLE_ALREADY_ASSIGNED: 'USER_ROLE_ALREADY_ASSIGNED',
  ROLE_STORE_MISMATCH: 'ROLE_STORE_MISMATCH',
  ROLE_CODE_RESERVED: 'ROLE_CODE_RESERVED',
  ROLE_PERMISSION_NON_DELEGATABLE: 'ROLE_PERMISSION_NON_DELEGATABLE',
  ROLE_PERMISSION_NO_ACCESS: 'ROLE_PERMISSION_NO_ACCESS',
  ROLE_PERMISSION_CEILING_EXCEEDED: 'ROLE_PERMISSION_CEILING_EXCEEDED',
  ROLE_PERMISSION_NOT_FOUND: 'ROLE_PERMISSION_NOT_FOUND',
  ROLE_PERMISSION_ALREADY_EXISTS: 'ROLE_PERMISSION_ALREADY_EXISTS',

  // ─── Location ───────────────────────────────────────────────────────────────
  COUNTRY_NOT_FOUND: 'COUNTRY_NOT_FOUND',
  COUNTRY_ALREADY_EXISTS: 'COUNTRY_ALREADY_EXISTS',
  STATE_NOT_FOUND: 'STATE_NOT_FOUND',
  STATE_ALREADY_EXISTS: 'STATE_ALREADY_EXISTS',
  CITY_NOT_FOUND: 'CITY_NOT_FOUND',
  CITY_ALREADY_EXISTS: 'CITY_ALREADY_EXISTS',
  ADMIN_DIVISION_NOT_FOUND: 'ADMIN_DIVISION_NOT_FOUND',
  POSTAL_CODE_NOT_FOUND: 'POSTAL_CODE_NOT_FOUND',
  POSTAL_CODE_ALREADY_EXISTS: 'POSTAL_CODE_ALREADY_EXISTS',
  LOC_INVALID_STATE_CODE: 'LOC_INVALID_STATE_CODE',
  LOC_INVALID_PINCODE: 'LOC_INVALID_PINCODE',

  // ─── Address ────────────────────────────────────────────────────────────────
  ADDRESS_NOT_FOUND: 'ADDRESS_NOT_FOUND',
  ADDRESS_TYPE_NOT_FOUND: 'ADDRESS_TYPE_NOT_FOUND',
  ADDRESS_LIMIT_EXCEEDED: 'ADDRESS_LIMIT_EXCEEDED',

  // ─── Communication ──────────────────────────────────────────────────────────
  COMMUNICATION_NOT_FOUND: 'COMMUNICATION_NOT_FOUND',
  COMMUNICATION_TYPE_NOT_FOUND: 'COMMUNICATION_TYPE_NOT_FOUND',
  COMMUNICATION_ALREADY_VERIFIED: 'COMMUNICATION_ALREADY_VERIFIED',

  // ─── Contact Person ─────────────────────────────────────────────────────────
  CONTACT_PERSON_NOT_FOUND: 'CONTACT_PERSON_NOT_FOUND',
  CONTACT_PERSON_TYPE_NOT_FOUND: 'CONTACT_PERSON_TYPE_NOT_FOUND',

  // ─── Notes ──────────────────────────────────────────────────────────────────
  NOTES_NOT_FOUND: 'NOTES_NOT_FOUND',
  NOTES_TYPE_NOT_FOUND: 'NOTES_TYPE_NOT_FOUND',

  // ─── Lookup Registries ──────────────────────────────────────────────────────
  SALUTATION_NOT_FOUND: 'SALUTATION_NOT_FOUND',
  DESIGNATION_NOT_FOUND: 'DESIGNATION_NOT_FOUND',
  STORE_LEGAL_TYPE_NOT_FOUND: 'STORE_LEGAL_TYPE_NOT_FOUND',
  STORE_CATEGORY_NOT_FOUND: 'STORE_CATEGORY_NOT_FOUND',
  CALLING_CODE_NOT_FOUND: 'CALLING_CODE_NOT_FOUND',
  VOLUME_NOT_FOUND: 'VOLUME_NOT_FOUND',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',

  // ─── Entity Status ──────────────────────────────────────────────────────────
  ENT_INVALID_CODE_FORMAT: 'ENT_INVALID_CODE_FORMAT',
  ENT_STATUS_NOT_FOUND: 'ENT_STATUS_NOT_FOUND',

  // ─── User Preferences / Pagination ──────────────────────────────────────────
  USR_INVALID_PAGE_SIZE: 'USR_INVALID_PAGE_SIZE',
  USR_INVALID_PAGE: 'USR_INVALID_PAGE',
  USR_INVALID_THEME: 'USR_INVALID_THEME',
  USR_INVALID_TIMEZONE: 'USR_INVALID_TIMEZONE',
  USR_PREFERENCES_NOT_FOUND: 'USR_PREFERENCES_NOT_FOUND',

  // ─── Status ─────────────────────────────────────────────────────────────────
  STA_INVALID_CODE: 'STA_INVALID_CODE',
  STA_STATUS_NOT_FOUND: 'STA_STATUS_NOT_FOUND',

  // ─── Codes ──────────────────────────────────────────────────────────────────
  COD_INVALID_VALUE: 'COD_INVALID_VALUE',
  COD_CODE_NOT_FOUND: 'COD_CODE_NOT_FOUND',
  COD_VALUE_NOT_FOUND: 'COD_VALUE_NOT_FOUND',
  COD_CATEGORY_NOT_FOUND: 'COD_CATEGORY_NOT_FOUND',
  COD_SYSTEM_IMMUTABLE: 'COD_SYSTEM_IMMUTABLE',
  COD_STORE_OWNERSHIP_REQUIRED: 'COD_STORE_OWNERSHIP_REQUIRED',
  COD_UPDATE_FAILED: 'COD_UPDATE_FAILED',

  // ─── File / Upload ──────────────────────────────────────────────────────────
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_SUPPORTED: 'FILE_TYPE_NOT_SUPPORTED',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',

  // ─── Tax ────────────────────────────────────────────────────────────────────
  TAX_AGENCY_NOT_FOUND: 'TAX_AGENCY_NOT_FOUND',
  TAX_NAME_NOT_FOUND: 'TAX_NAME_NOT_FOUND',
  TAX_RATE_NOT_FOUND: 'TAX_RATE_NOT_FOUND',
  COMMODITY_CODE_NOT_FOUND: 'COMMODITY_CODE_NOT_FOUND',
  TAX_REGISTRATION_NOT_FOUND: 'TAX_REGISTRATION_NOT_FOUND',
  TAX_REGISTRATION_EXISTS: 'TAX_REGISTRATION_EXISTS',

  // ─── Audit ─────────────────────────────────────────────────────────────
  AUDIT_INVALID_EVENT_TYPE: 'AUDIT_INVALID_EVENT_TYPE',
  AUDIT_LOG_NOT_FOUND: 'AUDIT_LOG_NOT_FOUND',

  // ─── Routes ────────────────────────────────────────────────────────────
  ROUTE_STORE_ACCESS_DENIED: 'ROUTE_STORE_ACCESS_DENIED',

  // ─── OTP (extended) ───────────────────────────────────────────────────

  // ─── Sync ──────────────────────────────────────────────────────────────
  SYNC_STORE_ACCESS_DENIED: 'SYNC_STORE_ACCESS_DENIED',
  SYNC_SESSION_EXPIRED: 'SYNC_SESSION_EXPIRED',
  SYNC_SESSION_INVALID_SIGNATURE: 'SYNC_SESSION_INVALID_SIGNATURE',
  SYNC_DEVICE_REVOKED: 'SYNC_DEVICE_REVOKED',
  SYNC_TOKEN_INVALID: 'SYNC_TOKEN_INVALID',
  SYNC_TOKEN_ROLE_MISMATCH: 'SYNC_TOKEN_ROLE_MISMATCH',
  SYNC_TOKEN_STORE_MISMATCH: 'SYNC_TOKEN_STORE_MISMATCH',

  // ─── Status (admin) ───────────────────────────────────────────────────
  STA_CODE_ALREADY_EXISTS: 'STA_CODE_ALREADY_EXISTS',
  STA_SYSTEM_IMMUTABLE: 'STA_SYSTEM_IMMUTABLE',

  // ─── Lookups ───────────────────────────────────────────────────────────
  LOOKUP_NOT_FOUND: 'LOOKUP_NOT_FOUND',
  LOOKUP_CATEGORY_NOT_FOUND: 'LOOKUP_CATEGORY_NOT_FOUND',
  LOOKUP_VALUE_NOT_FOUND: 'LOOKUP_VALUE_NOT_FOUND',
  LOOKUP_UPDATE_FAILED: 'LOOKUP_UPDATE_FAILED',

  // ─── Entity Status ─────────────────────────────────────────────────────
  ENT_STATUS_ALREADY_ASSIGNED: 'ENT_STATUS_ALREADY_ASSIGNED',
  ENT_STATUS_NOT_ASSIGNED: 'ENT_STATUS_NOT_ASSIGNED',

  // ─── User Creation ─────────────────────────────────────────────────────
  USER_CREATION_FAILED: 'USER_CREATION_FAILED',

  // ─── Database ───────────────────────────────────────────────────────────────
  DB_QUERY_FAILED: 'DB_QUERY_FAILED',
  DB_UNIQUE_CONSTRAINT_VIOLATION: 'DB_UNIQUE_CONSTRAINT_VIOLATION',
  DB_FOREIGN_KEY_VIOLATION: 'DB_FOREIGN_KEY_VIOLATION',
  DB_CONNECTION_FAILED: 'DB_CONNECTION_FAILED',
} as const;

/** Convenience type for all valid error code strings. */
export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable messages keyed by ErrorCode value
// ─────────────────────────────────────────────────────────────────────────────
export const ErrorMessages: Record<string, string> = {
  // General
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'An internal server error occurred. Please try again later.',
  [ErrorCode.VALIDATION_ERROR]: 'Invalid input provided.',
  [ErrorCode.BAD_REQUEST]: 'The request is invalid. Please check your input.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCode.CONFLICT]: 'A conflict occurred with the current state of the resource.',
  [ErrorCode.UNPROCESSABLE_ENTITY]: 'The request could not be processed.',
  [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests. Please try again later.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to access this resource.',
  [ErrorCode.UNAUTHORIZED]: 'You are not authorized to access this resource.',

  // Auth
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 'Invalid credentials.',
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: 'Account is disabled.',
  [ErrorCode.AUTH_ACCOUNT_LOCKED]: 'Account locked due to too many failed attempts. Please try again later.',
  [ErrorCode.AUTH_EMAIL_NOT_VERIFIED]: 'Email address has not been verified.',
  [ErrorCode.AUTH_TOKEN_EXPIRED]: 'Token has expired.',
  [ErrorCode.AUTH_TOKEN_INVALID]: 'Invalid or expired token.',
  [ErrorCode.AUTH_TOKEN_MISSING]: 'Authentication token is missing.',
  [ErrorCode.AUTH_REFRESH_TOKEN_INVALID]: 'Invalid refresh token.',
  [ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED]: 'Refresh token has expired.',
  [ErrorCode.AUTH_REFRESH_TOKEN_REVOKED]: 'Refresh token has been revoked. All sessions terminated.',
  [ErrorCode.AUTH_SESSION_NOT_FOUND]: 'Session not found.',
  [ErrorCode.AUTH_SESSION_EXPIRED]: 'Session has expired.',
  [ErrorCode.AUTH_SESSION_CREATE_FAILED]: 'Failed to create session.',
  [ErrorCode.AUTH_SESSION_ROTATION_FAILED]: 'Failed to rotate session.',
  [ErrorCode.AUTH_SESSION_COMPROMISED]: 'Session compromised. Please log in again.',
  [ErrorCode.AUTH_INVALID_SESSION_TOKEN]: 'Invalid session token.',
  [ErrorCode.AUTH_INVALID_SESSION_ID]: 'Invalid session ID.',
  [ErrorCode.AUTH_FORBIDDEN_SESSION]: 'You can only manage your own sessions.',
  [ErrorCode.AUTH_DEVICE_MISMATCH]: 'Refresh token device mismatch.',
  [ErrorCode.AUTH_INVALID_JWT_AUDIENCE]: 'Invalid JWT audience.',
  [ErrorCode.AUTH_PASSWORD_TOO_WEAK]: 'Password does not meet strength requirements. Must be at least 12 characters with uppercase, lowercase, number, and special character.',
  [ErrorCode.AUTH_PASSWORD_REQUIRED]: 'Password is required when adding an email address.',
  [ErrorCode.AUTH_PASSWORD_ALREADY_SET]: 'A password is already set on this account. Use the change-password flow instead.',
  [ErrorCode.AUTH_EMAIL_NOT_SET]: 'No email address on this account. Add an email via profile-complete first.',
  [ErrorCode.AUTH_INVALID_PHONE]: 'Invalid phone number format. Use +91XXXXXXXXXX or 10-digit number starting with 6-9.',
  [ErrorCode.AUTH_INVALID_EMAIL]: 'Invalid email format.',
  [ErrorCode.AUTH_NO_ADMIN_EXISTS]: 'No admin account exists. Create the first admin using email and password before using OTP login.',
  [ErrorCode.USER_BLOCKED]: 'Account is blocked. Please contact support.',

  // OTP
  [ErrorCode.OTP_INVALID]: 'Invalid OTP format. Expected 6 digits.',
  [ErrorCode.OTP_NOT_FOUND]: 'OTP request not found or already used.',
  [ErrorCode.OTP_EXPIRED]: 'OTP has expired.',
  [ErrorCode.OTP_ALREADY_USED]: 'OTP has already been used.',
  [ErrorCode.OTP_MAX_ATTEMPTS_EXCEEDED]: 'Maximum OTP attempts exceeded.',
  [ErrorCode.OTP_SEND_FAILED]: 'Failed to send OTP.',

  // User
  [ErrorCode.USER_NOT_FOUND]: 'User not found.',
  [ErrorCode.USER_EMAIL_ALREADY_EXISTS]: 'Email is already in use.',

  // Location
  [ErrorCode.STATE_NOT_FOUND]: 'State not found.',
  [ErrorCode.POSTAL_CODE_NOT_FOUND]: 'Pincode not found.',
  [ErrorCode.ADMIN_DIVISION_NOT_FOUND]: 'District not found.',
  [ErrorCode.LOC_INVALID_STATE_CODE]: 'Invalid state code format. Expected 2 uppercase letters (e.g., KA, MH, DL).',
  [ErrorCode.LOC_INVALID_PINCODE]: 'Invalid pincode format. Expected 6 digits (e.g., 110001).',

  // Entity Status
  [ErrorCode.ENT_INVALID_CODE_FORMAT]: 'Invalid entity code format. Use lowercase alphanumeric, underscores, or dashes.',
  [ErrorCode.ENT_STATUS_NOT_FOUND]: 'Status not found.',
  [ErrorCode.ENTITY_NOT_FOUND]: 'Entity not found.',

  // User Preferences / Pagination
  [ErrorCode.USR_INVALID_PAGE_SIZE]: 'Page size must be between 1 and 100.',
  [ErrorCode.USR_INVALID_PAGE]: 'Page number must be at least 1.',
  [ErrorCode.USR_INVALID_THEME]: 'Invalid theme. Allowed values: light, dark, auto.',
  [ErrorCode.USR_INVALID_TIMEZONE]: 'Invalid timezone. Please provide a valid IANA timezone.',
  [ErrorCode.USR_PREFERENCES_NOT_FOUND]: 'User preferences not found.',

  // Status
  [ErrorCode.STA_INVALID_CODE]: 'Invalid status code.',
  [ErrorCode.STA_STATUS_NOT_FOUND]: 'Status not found.',

  // Codes
  [ErrorCode.COD_INVALID_VALUE]: 'Invalid code value.',
  [ErrorCode.COD_CODE_NOT_FOUND]: 'Code not found.',
  [ErrorCode.COD_VALUE_NOT_FOUND]: 'Code value not found.',
  [ErrorCode.COD_CATEGORY_NOT_FOUND]: 'Code category not found.',
  [ErrorCode.COD_SYSTEM_IMMUTABLE]: 'System values cannot be modified.',
  [ErrorCode.COD_STORE_OWNERSHIP_REQUIRED]: 'You do not own this store.',
  [ErrorCode.COD_UPDATE_FAILED]: 'Failed to update code value.',

  // Audit
  [ErrorCode.AUDIT_INVALID_EVENT_TYPE]: 'Invalid audit event type.',
  [ErrorCode.AUDIT_LOG_NOT_FOUND]: 'Audit log not found.',

  // Routes
  [ErrorCode.ROUTE_STORE_ACCESS_DENIED]: 'You do not have access to this store.',

  // Roles (extended)
  [ErrorCode.ROLE_STORE_MISMATCH]: 'You can only manage roles for your active store.',
  [ErrorCode.ROLE_CODE_RESERVED]: 'This role code is reserved for system roles.',
  [ErrorCode.ROLE_PERMISSION_NON_DELEGATABLE]: 'This permission cannot be assigned to custom roles.',
  [ErrorCode.ROLE_PERMISSION_NO_ACCESS]: 'You do not have access to this entity and cannot assign its permissions.',
  [ErrorCode.ROLE_PERMISSION_CEILING_EXCEEDED]: 'You cannot grant a permission you do not hold.',

  // Sync
  [ErrorCode.SYNC_STORE_ACCESS_DENIED]: 'You do not have access to this store.',
  [ErrorCode.SYNC_SESSION_EXPIRED]: 'Offline session has expired.',
  [ErrorCode.SYNC_SESSION_INVALID_SIGNATURE]: 'Offline session signature is invalid.',
  [ErrorCode.SYNC_DEVICE_REVOKED]: 'Device access has been revoked.',
  [ErrorCode.SYNC_TOKEN_INVALID]: 'Offline token is invalid or expired.',
  [ErrorCode.SYNC_TOKEN_ROLE_MISMATCH]: 'Offline token roles do not match session.',
  [ErrorCode.SYNC_TOKEN_STORE_MISMATCH]: 'Offline token store does not match session.',

  // Status (admin extended)
  [ErrorCode.STA_CODE_ALREADY_EXISTS]: 'Status code already exists.',
  [ErrorCode.STA_SYSTEM_IMMUTABLE]: 'System statuses cannot be modified.',

  // Lookups
  [ErrorCode.LOOKUP_NOT_FOUND]: 'Lookup not found.',
  [ErrorCode.LOOKUP_CATEGORY_NOT_FOUND]: 'Lookup category not found.',
  [ErrorCode.LOOKUP_VALUE_NOT_FOUND]: 'Lookup value not found.',
  [ErrorCode.LOOKUP_UPDATE_FAILED]: 'Failed to update lookup value.',

  // Entity Status (extended)
  [ErrorCode.ENT_STATUS_ALREADY_ASSIGNED]: 'Status is already assigned to this entity.',
  [ErrorCode.ENT_STATUS_NOT_ASSIGNED]: 'Status is not assigned to this entity.',

  // User Creation
  [ErrorCode.USER_CREATION_FAILED]: 'Failed to create user.',
};

/**
 * Returns a typed { errorCode, message } payload for a given ErrorCode key.
 * Keeps the code+message pair in sync — no risk of mismatching them at call sites.
 *
 * Usage:  throw new UnauthorizedException(errPayload(ErrorCode.AUTH_INVALID_CREDENTIALS));
 */
export function errPayload(code: ErrorCodeType): { errorCode: string; message: string } {
  return { errorCode: code, message: ErrorMessages[code] ?? code };
}
