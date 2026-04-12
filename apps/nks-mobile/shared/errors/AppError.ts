import { ErrorCode, ErrorContext, ERROR_MESSAGES } from "../types/errors";

/**
 * Centralized error class for the application
 * All errors flow through this class for consistent handling
 *
 * @example
 * throw new AppError(
 *   ErrorCode.INVALID_PHONE,
 *   'Phone number must be 10 digits',
 *   400,
 *   { phone: '123' }
 * );
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly message: string;
  public readonly statusCode?: number;
  public readonly context: ErrorContext;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode?: number,
    context: ErrorContext = {},
  ) {
    // Use provided message or fall back to default
    const finalMessage = message || ERROR_MESSAGES[code];

    super(finalMessage);
    this.name = "AppError";
    this.code = code;
    this.message = finalMessage;
    this.statusCode = statusCode;
    this.context = context;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Check if this error is a specific code
   */
  isCode(code: ErrorCode): boolean {
    return this.code === code;
  }

  /**
   * Check if this is a network error
   */
  isNetworkError(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.CONNECTION_LOST,
    ].includes(this.code);
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return [
      ErrorCode.AUTH_ERROR,
      ErrorCode.UNAUTHORIZED,
      ErrorCode.SESSION_EXPIRED,
      ErrorCode.INVALID_CREDENTIALS,
    ].includes(this.code);
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return [
      ErrorCode.VALIDATION_ERROR,
      ErrorCode.INVALID_PHONE,
      ErrorCode.INVALID_OTP,
      ErrorCode.INVALID_PASSWORD,
    ].includes(this.code);
  }

  /**
   * Check if this is a server error
   */
  isServerError(): boolean {
    return [ErrorCode.SERVER_ERROR, ErrorCode.SERVICE_UNAVAILABLE].includes(
      this.code,
    );
  }

  /**
   * Get user-facing message
   * Use this to display to users
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Get developer-friendly message with context
   * Use this for logging
   */
  getDeveloperMessage(): string {
    let msg = `[${this.code}] ${this.message}`;
    if (this.statusCode) msg += ` (HTTP ${this.statusCode})`;
    if (Object.keys(this.context).length > 0) {
      msg += ` | Context: ${JSON.stringify(this.context)}`;
    }
    return msg;
  }

  /**
   * Convert to JSON for logging/reporting
   */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      context: this.context,
      name: this.name,
    };
  }
}

/**
 * Type guard to check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
