import axios, { AxiosError } from 'axios';
import { AppError, isAppError } from './AppError';
import { ErrorCode, ErrorContext } from '../types/errors';

/**
 * Centralized error handler that transforms various error types into AppError
 * Used throughout repositories and services to standardize error handling
 *
 * @example
 * try {
 *   await api.post('/auth/send-otp', { phone });
 * } catch (error) {
 *   throw ErrorHandler.handle(error, { phone });
 * }
 */
export class ErrorHandler {
  /**
   * Handle any error type and convert to AppError
   * Supports: AppError, AxiosError, Error, and unknown types
   */
  static handle(error: unknown, context: ErrorContext = {}): AppError {
    // Already an AppError, just add context and return
    if (isAppError(error)) {
      return new AppError(
        error.code,
        error.message,
        error.statusCode,
        { ...error.context, ...context },
      );
    }

    // Axios error (HTTP request failed)
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error, context);
    }

    // Standard JavaScript Error
    if (error instanceof Error) {
      return this.handleStandardError(error, context);
    }

    // Unknown error type
    return new AppError(
      ErrorCode.UNKNOWN_ERROR,
      'An unexpected error occurred',
      undefined,
      { ...context, errorMessage: String(error) },
    );
  }

  /**
   * Handle axios errors (network, HTTP status codes, etc.)
   */
  private static handleAxiosError(
    error: AxiosError,
    context: ErrorContext,
  ): AppError {
    const status = error.response?.status;
    const data = error.response?.data as Record<string, any> | undefined;

    // Network error (no response from server)
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

    // 400 Bad Request - Validation error
    if (status === 400) {
      return new AppError(
        ErrorCode.VALIDATION_ERROR,
        data?.message || 'Invalid input. Please check your data.',
        400,
        { ...context, field: data?.field, errorDetails: error.message },
      );
    }

    // 401 Unauthorized - Session expired or invalid credentials
    if (status === 401) {
      // Check if it's specifically invalid OTP or invalid credentials
      const errorCode = data?.code;
      if (errorCode === 'OTP_INVALID') {
        return new AppError(
          ErrorCode.OTP_INVALID,
          'Invalid OTP. Please try again.',
          401,
          { ...context },
        );
      }
      if (errorCode === 'OTP_EXPIRED') {
        return new AppError(
          ErrorCode.OTP_EXPIRED,
          'OTP has expired. Please request a new one.',
          401,
          { ...context },
        );
      }
      if (errorCode === 'INVALID_CREDENTIALS') {
        return new AppError(
          ErrorCode.INVALID_CREDENTIALS,
          'Invalid phone number or OTP.',
          401,
          { ...context },
        );
      }

      // Generic 401
      return new AppError(
        ErrorCode.SESSION_EXPIRED,
        'Your session has expired. Please log in again.',
        401,
        { ...context },
      );
    }

    // 403 Forbidden - Permission denied
    if (status === 403) {
      return new AppError(
        ErrorCode.FORBIDDEN,
        'You do not have permission for this action.',
        403,
        { ...context },
      );
    }

    // 404 Not Found
    if (status === 404) {
      return new AppError(
        ErrorCode.NOT_FOUND,
        'Resource not found.',
        404,
        { ...context },
      );
    }

    // 409 Conflict - User exists, store exists, etc.
    if (status === 409) {
      const conflictCode = data?.code;
      if (conflictCode === 'USER_EXISTS') {
        return new AppError(
          ErrorCode.USER_EXISTS,
          'User already exists.',
          409,
          { ...context },
        );
      }
      return new AppError(
        ErrorCode.VALIDATION_ERROR,
        data?.message || 'Resource conflict.',
        409,
        { ...context },
      );
    }

    // 5xx Server errors
    if (status && status >= 500) {
      if (status === 503) {
        return new AppError(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Service is temporarily unavailable. Please try again later.',
          status,
          { ...context },
        );
      }

      return new AppError(
        ErrorCode.SERVER_ERROR,
        'Server error. Please try again later.',
        status,
        { ...context, endpoint: error.config?.url },
      );
    }

    // Any other HTTP error
    return new AppError(
      ErrorCode.UNKNOWN_ERROR,
      data?.message || `HTTP Error ${status || 'Unknown'}`,
      status,
      { ...context, endpoint: error.config?.url },
    );
  }

  /**
   * Handle standard JavaScript errors
   */
  private static handleStandardError(
    error: Error,
    context: ErrorContext,
  ): AppError {
    // Specific error types
    if (error.name === 'ValidationError') {
      return new AppError(
        ErrorCode.VALIDATION_ERROR,
        error.message || 'Validation failed',
        undefined,
        { ...context },
      );
    }

    if (error.name === 'NetworkError') {
      return new AppError(
        ErrorCode.NETWORK_ERROR,
        error.message || 'Network error occurred',
        undefined,
        { ...context },
      );
    }

    // Generic error
    return new AppError(
      ErrorCode.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred',
      undefined,
      { ...context, errorDetails: error.message },
    );
  }

}
