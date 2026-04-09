/**
 * Error Code and Message Constants
 * Format: [DOMAIN]-[TYPE]-[NUMBER]
 *
 * Domain: AUTH, LOC, ENT, USR, STA, COD, etc.
 * Type: ERR (error), VAL (validation), NOT-FOUND, CONFLICT
 * Number: Sequential
 */

export const ErrorCodes = {
  // General Errors
  GEN_INVALID_REQUEST: 'GEN-ERR-001',
  GEN_INVALID_INPUT: 'GEN-ERR-002',
  GEN_UNAUTHORIZED: 'GEN-ERR-003',
  GEN_FORBIDDEN: 'GEN-ERR-004',
  GEN_INTERNAL_ERROR: 'GEN-ERR-005',

  // Auth - Validation Errors
  AUTH_INVALID_PHONE: 'AUTH-VAL-001',
  AUTH_INVALID_EMAIL: 'AUTH-VAL-002',
  AUTH_WEAK_PASSWORD: 'AUTH-VAL-003',
  AUTH_INVALID_OTP: 'AUTH-VAL-004',

  // Auth - Not Found Errors
  AUTH_SESSION_NOT_FOUND: 'AUTH-NOT-FOUND-001',
  AUTH_USER_NOT_FOUND: 'AUTH-NOT-FOUND-002',

  // Auth - Other Errors
  AUTH_TOKEN_EXPIRED: 'AUTH-ERR-001',
  AUTH_INVALID_CREDENTIALS: 'AUTH-ERR-002',
  AUTH_REFRESH_TOKEN_REVOKED: 'AUTH-ERR-003',

  // Location - Validation Errors
  LOC_INVALID_STATE_CODE: 'LOC-VAL-001',
  LOC_INVALID_PINCODE: 'LOC-VAL-002',

  // Location - Not Found Errors
  LOC_STATE_NOT_FOUND: 'LOC-NOT-FOUND-001',
  LOC_PINCODE_NOT_FOUND: 'LOC-NOT-FOUND-002',
  LOC_DISTRICT_NOT_FOUND: 'LOC-NOT-FOUND-003',

  // Entity Status - Validation Errors
  ENT_INVALID_CODE_FORMAT: 'ENT-VAL-001',

  // Entity Status - Not Found Errors
  ENT_STATUS_NOT_FOUND: 'ENT-NOT-FOUND-001',
  ENT_ENTITY_NOT_FOUND: 'ENT-NOT-FOUND-002',

  // User - Validation Errors
  USR_INVALID_PAGE_SIZE: 'USR-VAL-001',
  USR_INVALID_THEME: 'USR-VAL-002',
  USR_INVALID_TIMEZONE: 'USR-VAL-003',

  // User - Not Found Errors
  USR_PREFERENCES_NOT_FOUND: 'USR-NOT-FOUND-001',

  // Status - Validation Errors
  STA_INVALID_CODE: 'STA-VAL-001',

  // Status - Not Found Errors
  STA_STATUS_NOT_FOUND: 'STA-NOT-FOUND-001',

  // Codes - Validation Errors
  COD_INVALID_VALUE: 'COD-VAL-001',

  // Codes - Not Found Errors
  COD_CODE_NOT_FOUND: 'COD-NOT-FOUND-001',
  COD_VALUE_NOT_FOUND: 'COD-NOT-FOUND-002',
};

export const ErrorMessages = {
  // General
  [ErrorCodes.GEN_INVALID_REQUEST]:
    'The request is invalid. Please check your input.',
  [ErrorCodes.GEN_INVALID_INPUT]:
    'Invalid input provided.',
  [ErrorCodes.GEN_UNAUTHORIZED]:
    'You are not authorized to access this resource.',
  [ErrorCodes.GEN_FORBIDDEN]:
    'You do not have permission to access this resource.',
  [ErrorCodes.GEN_INTERNAL_ERROR]:
    'An internal server error occurred. Please try again later.',

  // Auth - Validation
  [ErrorCodes.AUTH_INVALID_PHONE]:
    'Invalid phone number format. Use +91XXXXXXXXXX or 10-digit number starting with 6-9.',
  [ErrorCodes.AUTH_INVALID_EMAIL]:
    'Invalid email format.',
  [ErrorCodes.AUTH_WEAK_PASSWORD]:
    'Password does not meet strength requirements. Must be at least 12 characters with uppercase, lowercase, number, and special character.',
  [ErrorCodes.AUTH_INVALID_OTP]:
    'Invalid OTP format. Expected 6 digits.',

  // Auth - Not Found
  [ErrorCodes.AUTH_SESSION_NOT_FOUND]:
    'Session not found.',
  [ErrorCodes.AUTH_USER_NOT_FOUND]:
    'User not found.',

  // Auth - Other
  [ErrorCodes.AUTH_TOKEN_EXPIRED]:
    'Token has expired.',
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]:
    'Invalid credentials.',
  [ErrorCodes.AUTH_REFRESH_TOKEN_REVOKED]:
    'Refresh token has been revoked. All sessions terminated.',

  // Location - Validation
  [ErrorCodes.LOC_INVALID_STATE_CODE]:
    'Invalid state code format. Expected 2 uppercase letters (e.g., KA, MH, DL).',
  [ErrorCodes.LOC_INVALID_PINCODE]:
    'Invalid pincode format. Expected 6 digits (e.g., 110001).',

  // Location - Not Found
  [ErrorCodes.LOC_STATE_NOT_FOUND]:
    'State not found.',
  [ErrorCodes.LOC_PINCODE_NOT_FOUND]:
    'Pincode not found.',
  [ErrorCodes.LOC_DISTRICT_NOT_FOUND]:
    'District not found.',

  // Entity Status - Validation
  [ErrorCodes.ENT_INVALID_CODE_FORMAT]:
    'Invalid entity code format. Use lowercase alphanumeric, underscores, or dashes.',

  // Entity Status - Not Found
  [ErrorCodes.ENT_STATUS_NOT_FOUND]:
    'Status not found.',
  [ErrorCodes.ENT_ENTITY_NOT_FOUND]:
    'Entity not found.',

  // User - Validation
  [ErrorCodes.USR_INVALID_PAGE_SIZE]:
    'Page size must be between 1 and 100.',
  [ErrorCodes.USR_INVALID_THEME]:
    'Invalid theme. Allowed values: light, dark, auto.',
  [ErrorCodes.USR_INVALID_TIMEZONE]:
    'Invalid timezone. Please provide a valid IANA timezone.',

  // User - Not Found
  [ErrorCodes.USR_PREFERENCES_NOT_FOUND]:
    'User preferences not found.',

  // Status - Validation
  [ErrorCodes.STA_INVALID_CODE]:
    'Invalid status code.',

  // Status - Not Found
  [ErrorCodes.STA_STATUS_NOT_FOUND]:
    'Status not found.',

  // Codes - Validation
  [ErrorCodes.COD_INVALID_VALUE]:
    'Invalid code value.',

  // Codes - Not Found
  [ErrorCodes.COD_CODE_NOT_FOUND]:
    'Code not found.',
  [ErrorCodes.COD_VALUE_NOT_FOUND]:
    'Code value not found.',
};
