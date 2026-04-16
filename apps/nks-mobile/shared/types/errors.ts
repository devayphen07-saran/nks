/**
 * Centralized error codes for the application
 * Used to identify error types across all layers
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_LOST = 'CONNECTION_LOST',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PHONE = 'INVALID_PHONE',
  INVALID_OTP = 'INVALID_OTP',
  INVALID_PASSWORD = 'INVALID_PASSWORD',

  // Authentication errors
  AUTH_ERROR = 'AUTH_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  OTP_EXPIRED = 'OTP_EXPIRED',
  OTP_INVALID = 'OTP_INVALID',
  OTP_ALREADY_USED = 'OTP_ALREADY_USED',
  OTP_MAX_ATTEMPTS = 'OTP_MAX_ATTEMPTS',
  RATE_LIMITED = 'RATE_LIMITED',

  // Server errors
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  SERVER_ERROR = 'SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Business logic errors
  USER_EXISTS = 'USER_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_BLOCKED = 'USER_BLOCKED',
  STORE_NOT_FOUND = 'STORE_NOT_FOUND',

  // Unknown/generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * User-facing error messages
 * Keep these friendly and actionable
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again.',
  [ErrorCode.CONNECTION_LOST]: 'Connection lost. Please check your internet.',

  [ErrorCode.VALIDATION_ERROR]: 'Please check your input.',
  [ErrorCode.INVALID_PHONE]: 'Please enter a valid phone number.',
  [ErrorCode.INVALID_OTP]: 'OTP must be 6 digits.',
  [ErrorCode.INVALID_PASSWORD]: 'Password must be at least 8 characters.',

  [ErrorCode.AUTH_ERROR]: 'Authentication failed. Please try again.',
  [ErrorCode.UNAUTHORIZED]: 'You are not authorized for this action.',
  [ErrorCode.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid phone number or OTP.',
  [ErrorCode.ACCOUNT_LOCKED]: 'Your account is temporarily locked. Please try again later.',
  [ErrorCode.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',
  [ErrorCode.OTP_EXPIRED]: 'OTP has expired. Please request a new one.',
  [ErrorCode.OTP_INVALID]: 'Invalid OTP. Please try again.',
  [ErrorCode.OTP_ALREADY_USED]: 'This OTP has already been used. Please request a new one.',
  [ErrorCode.OTP_MAX_ATTEMPTS]: 'Too many failed attempts. Please try later.',
  [ErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.',

  [ErrorCode.NOT_FOUND]: 'Resource not found.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission for this action.',
  [ErrorCode.SERVER_ERROR]: 'Server error. Please try again later.',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',

  [ErrorCode.USER_EXISTS]: 'User already exists.',
  [ErrorCode.USER_NOT_FOUND]: 'User not found.',
  [ErrorCode.USER_BLOCKED]: 'Your account has been blocked. Please contact support.',
  [ErrorCode.STORE_NOT_FOUND]: 'Store not found.',

  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
};

/**
 * Error context object for additional debugging info
 */
export interface ErrorContext {
  phone?: string;
  otp?: string;
  userId?: string;
  storeId?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  statusCode?: number;
  originalError?: Error;
  [key: string]: any;
}
