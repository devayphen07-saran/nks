/**
 * Application Constants
 * Centralized configuration for all hardcoded magic numbers and strings
 *
 * ⚠️ IMPORTANT: These values should be configurable via environment variables
 * for different deployment environments (dev, staging, prod)
 */

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

// ============================================================================
// AUTH & SESSION CONFIGURATION
// ============================================================================

export const AUTH_CONSTANTS = {
  // JWT Configuration
  JWT: {
    EXPIRY_DAYS: 30,
    EXPIRY_MS: 30 * 24 * 60 * 60 * 1000,
    ALGORITHM: 'HS256',
  },

  // Session Configuration
  SESSION: {
    EXPIRY_DAYS: 30,
    EXPIRY_SECONDS: 60 * 60 * 24 * 30,
    UPDATE_AGE_SECONDS: 60 * 60 * 24, // Refresh if older than 1 day
    COOKIE_NAME: 'nks_session',
    COOKIE_SECURE: process.env.NODE_ENV === 'production',
    COOKIE_HTTP_ONLY: true,
    COOKIE_SAME_SITE: 'lax' as const,
    COOKIE_PATH: '/',
  },

  // Login Attempts & Lockout
  ACCOUNT_SECURITY: {
    MAX_FAILED_LOGIN_ATTEMPTS: 5,
    ACCOUNT_LOCKOUT_MINUTES: 15,
    ACCOUNT_LOCKOUT_MS: 15 * 60 * 1000,
  },

  // Role & Permission Cache
  CACHE: {
    ROLE_TTL_SECONDS: 5 * 60, // 5 minutes
    PERMISSION_TTL_SECONDS: 10 * 60, // 10 minutes
  },

  // Device Tracking
  SUPPORTED_DEVICE_TYPES: ['IOS', 'ANDROID', 'WEB'] as const,

  // Password Requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: true,
    SPECIAL_CHARS_REGEX: /[!@#$%^&*]/,
  },
} as const;

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

export const RATE_LIMIT_CONSTANTS = {
  // Global Rate Limit
  GLOBAL: {
    WINDOW_SECONDS: 60,
    MAX_REQUESTS: 100,
  },

  // Sign-in Rate Limit
  SIGN_IN: {
    WINDOW_SECONDS: 60 * 15, // 15 minutes
    MAX_ATTEMPTS: 5,
  },

  // Sign-up Rate Limit
  SIGN_UP: {
    WINDOW_SECONDS: 60 * 10, // 10 minutes
    MAX_ATTEMPTS: 10,
  },

  // OTP Rate Limit
  OTP: {
    WINDOW_SECONDS: 60,
    MAX_REQUESTS: 3,
    RESEND_COOLDOWN_SECONDS: 60,
  },
} as const;

// ============================================================================
// OTP CONFIGURATION
// ============================================================================

export const OTP_CONSTANTS = {
  // SMS OTP
  SMS: {
    LENGTH: 6,
    MIN_VALUE: 100000,
    MAX_VALUE: 999999,
    EXPIRY_MINUTES: 10,
    EXPIRY_MS: 10 * 60 * 1000,
    MAX_ATTEMPTS: 5,
  },

  // Email OTP
  EMAIL: {
    LENGTH: 6,
    MIN_VALUE: 100000,
    MAX_VALUE: 999999,
    EXPIRY_HOURS: 24,
    EXPIRY_MS: 24 * 60 * 60 * 1000,
    MAX_ATTEMPTS: 3,
  },

  // Token Generation
  TOKEN: {
    LENGTH: 32,
    CHARSET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  },
} as const;

// ============================================================================
// STORE & STAFF CONFIGURATION
// ============================================================================

export const STORE_CONSTANTS = {
  // Staff Roles (custom roles available for assignment to STAFF members)
  STAFF_ROLES: ['MANAGER', 'CASHIER', 'DELIVERY'] as const,

  // Customer Role (non-authenticated access)
  CUSTOMER_ROLE: 'CUSTOMER' as const,

  // Staff Invite
  STAFF_INVITE: {
    TOKEN_LENGTH: 32,
    EXPIRY_DAYS: 7,
    EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
    MAX_INVITES_PER_STORE_PER_DAY: 50,
  },

  // Store Code Format
  STORE_CODE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[A-Z0-9_-]+$/, // Alphanumeric, underscore, hyphen
  },
} as const;

// ============================================================================
// PAGINATION & QUERY DEFAULTS
// ============================================================================

export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PAGE_SIZE: 1,
} as const;

// ============================================================================
// CORS & SECURITY CONFIGURATION
// ============================================================================

export const CORS_CONSTANTS = {
  // Default origin for development (should be environment-based)
  DEFAULT_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-Request-ID'],
  EXPOSE_HEADERS: ['Content-Range', 'X-Content-Range'],
  CREDENTIALS: true,
} as const;

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER_CONSTANTS = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  HOST: process.env.HOST || 'localhost',
  API_BASE_PATH: '/api/v1',
  API_VERSION: '2026-03',
  REQUEST_TIMEOUT_MS: 30 * 1000,
} as const;

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

export const DATABASE_CONSTANTS = {
  // Connection Pool
  POOL: {
    MIN_SIZE: 5,
    MAX_SIZE: 20,
  },

  // Query Timeout
  QUERY_TIMEOUT_MS: 30 * 1000,

  // Transaction Timeout
  TRANSACTION_TIMEOUT_MS: 60 * 1000,
} as const;

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
  URL: /^https?:\/\/.+/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  POSTAL_CODE: /^[A-Z0-9]{3,20}$/i,
  STORE_CODE: /^[A-Z0-9_-]+$/,
} as const;

// ============================================================================
// ERROR MESSAGE CONSTANTS
// ============================================================================

export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED:
    'Account locked due to too many failed attempts. Try again later.',
  INVALID_OTP: 'Invalid or expired OTP',
  OTP_EXPIRED: 'OTP has expired. Please request a new one.',
  INVALID_TOKEN: 'Invalid or expired token',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource already exists',
  RATE_LIMIT: 'Too many requests. Please try again later.',
  INVALID_PASSWORD: 'Password does not meet requirements',
  WEAK_PASSWORD: 'Password is too weak',
} as const;

// ============================================================================
// SUCCESS MESSAGE CONSTANTS
// ============================================================================

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logged out successfully',
  REGISTRATION_SUCCESS: 'Registration successful',
  OTP_SENT: 'OTP sent successfully',
  OTP_VERIFIED: 'OTP verified successfully',
  PASSWORD_RESET: 'Password reset successfully',
  STORE_CREATED: 'Store created successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
} as const;

export type DeviceType = (typeof AUTH_CONSTANTS.SUPPORTED_DEVICE_TYPES)[number];
export type StaffRole = (typeof STORE_CONSTANTS.STAFF_ROLES)[number];
