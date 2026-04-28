import axios, { AxiosError } from 'axios';
import { AppError, isAppError } from './AppError';
import { ErrorCode, ErrorContext } from '../types/errors';

/**
 * Maps backend `code` strings (from ApiResponse.code) to mobile ErrorCode values.
 * Add entries here whenever the backend introduces a new error code.
 */
const BACKEND_ERROR_CODE_MAP: Record<string, ErrorCode> = {
  // OTP
  OTP_INVALID: ErrorCode.OTP_INVALID,
  OTP_EXPIRED: ErrorCode.OTP_EXPIRED,
  OTP_ALREADY_USED: ErrorCode.OTP_ALREADY_USED,
  OTP_MAX_ATTEMPTS_EXCEEDED: ErrorCode.OTP_MAX_ATTEMPTS,
  OTP_SEND_FAILED: ErrorCode.SERVER_ERROR,

  // Auth / session
  AUTH_NO_ADMIN_EXISTS: ErrorCode.AUTH_NO_ADMIN,
  AUTH_INVALID_CREDENTIALS: ErrorCode.INVALID_CREDENTIALS,
  AUTH_ACCOUNT_LOCKED: ErrorCode.ACCOUNT_LOCKED,
  AUTH_ACCOUNT_DISABLED: ErrorCode.ACCOUNT_DISABLED,
  AUTH_TOKEN_EXPIRED: ErrorCode.SESSION_EXPIRED,
  AUTH_TOKEN_INVALID: ErrorCode.UNAUTHORIZED,
  AUTH_TOKEN_MISSING: ErrorCode.UNAUTHORIZED,
  AUTH_REFRESH_TOKEN_EXPIRED: ErrorCode.SESSION_EXPIRED,
  AUTH_REFRESH_TOKEN_INVALID: ErrorCode.SESSION_EXPIRED,
  AUTH_SESSION_NOT_FOUND: ErrorCode.SESSION_EXPIRED,
  AUTH_SESSION_EXPIRED: ErrorCode.SESSION_EXPIRED,

  // User
  USER_ALREADY_EXISTS: ErrorCode.USER_EXISTS,
  USER_EMAIL_ALREADY_EXISTS: ErrorCode.USER_EXISTS,
  USER_PHONE_ALREADY_EXISTS: ErrorCode.USER_EXISTS,
  USER_NOT_FOUND: ErrorCode.USER_NOT_FOUND,
  USER_BLOCKED: ErrorCode.USER_BLOCKED,
  USER_INACTIVE: ErrorCode.ACCOUNT_DISABLED,

  // Generic HTTP
  FORBIDDEN: ErrorCode.FORBIDDEN,
  NOT_FOUND: ErrorCode.NOT_FOUND,
  TOO_MANY_REQUESTS: ErrorCode.RATE_LIMITED,
  VALIDATION_ERROR: ErrorCode.VALIDATION_ERROR,
};

function mapBackendCode(code: string | undefined): ErrorCode | undefined {
  return code ? BACKEND_ERROR_CODE_MAP[code] : undefined;
}

function handleAxiosError(error: AxiosError, context: ErrorContext): AppError {
  const status = error.response?.status;
  const data = error.response?.data as Record<string, unknown> | undefined;

  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return new AppError(
        ErrorCode.TIMEOUT_ERROR,
        'Request timed out. Please try again.',
        undefined,
        { ...context, endpoint: error.config?.url },
      );
    }
    return new AppError(
      ErrorCode.NETWORK_ERROR,
      'Network error. Please check your connection.',
      undefined,
      { ...context, endpoint: error.config?.url },
    );
  }

  const mapped = mapBackendCode((data?.errorCode ?? data?.code) as string | undefined);

  if (status === 400) {
    return new AppError(
      mapped ?? ErrorCode.VALIDATION_ERROR,
      data?.message as string | undefined,
      400,
      { ...context, field: data?.field },
    );
  }
  if (status === 401) {
    return new AppError(mapped ?? ErrorCode.SESSION_EXPIRED, undefined, 401, context);
  }
  if (status === 403) {
    return new AppError(mapped ?? ErrorCode.FORBIDDEN, undefined, 403, context);
  }
  if (status === 404) {
    return new AppError(mapped ?? ErrorCode.NOT_FOUND, undefined, 404, context);
  }
  if (status === 409) {
    return new AppError(mapped ?? ErrorCode.VALIDATION_ERROR, undefined, 409, context);
  }
  if (status === 429) {
    return new AppError(ErrorCode.RATE_LIMITED, undefined, 429, context);
  }
  if (status && status >= 500) {
    return new AppError(
      status === 503 ? ErrorCode.SERVICE_UNAVAILABLE : ErrorCode.SERVER_ERROR,
      undefined,
      status,
      { ...context, endpoint: error.config?.url },
    );
  }

  return new AppError(
    mapped ?? ErrorCode.UNKNOWN_ERROR,
    (data?.message as string | undefined) || `HTTP Error ${status ?? 'Unknown'}`,
    status,
    { ...context, endpoint: error.config?.url },
  );
}

function handleStandardError(error: Error, context: ErrorContext): AppError {
  if (error.name === 'ValidationError') {
    return new AppError(ErrorCode.VALIDATION_ERROR, error.message || 'Validation failed', undefined, context);
  }
  if (error.name === 'NetworkError') {
    return new AppError(ErrorCode.NETWORK_ERROR, error.message || 'Network error occurred', undefined, context);
  }
  return new AppError(
    ErrorCode.UNKNOWN_ERROR,
    error.message || 'An unexpected error occurred',
    undefined,
    { ...context, errorDetails: error.message },
  );
}

/**
 * Transforms any error type into an AppError with consistent shape.
 *
 * @example
 * try {
 *   await api.post('/auth/send-otp', { phone });
 * } catch (error) {
 *   throw handleError(error, { phone });
 * }
 */
export function handleError(error: unknown, context: ErrorContext = {}): AppError {
  if (isAppError(error)) {
    return new AppError(error.code, error.message, error.statusCode, { ...error.context, ...context });
  }
  if (axios.isAxiosError(error)) {
    return handleAxiosError(error, context);
  }
  if (error instanceof Error) {
    return handleStandardError(error, context);
  }
  if (error === undefined || error === null) {
    return new AppError(ErrorCode.NETWORK_ERROR, 'Network error. Please check your connection.', undefined, context);
  }
  if (typeof error === 'object' && ('errorCode' in error || 'code' in error)) {
    const apiErr = error as { errorCode?: string; code?: string; message?: string; statusCode?: number };
    const mapped = mapBackendCode(apiErr.errorCode ?? apiErr.code);
    return new AppError(
      mapped ?? ErrorCode.UNKNOWN_ERROR,
      apiErr.message || 'An unexpected error occurred',
      apiErr.statusCode,
      context,
    );
  }
  return new AppError(
    ErrorCode.UNKNOWN_ERROR,
    'An unexpected error occurred',
    undefined,
    { ...context, errorMessage: String(error) },
  );
}

/** @deprecated Use `handleError` directly */
export const ErrorHandler = { handle: handleError };
