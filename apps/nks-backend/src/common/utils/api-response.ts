/**
 * Standard API Response Wrapper for NestJS
 *
 * Structure:
 * {
 *   status:     'success' | 'error' | 'warning',
 *   statusCode: number,              // HTTP status code (200, 400, 404, 500, etc.)
 *   message:    string,              // Human-readable message
 *   errorCode:  string | null,       // Machine-readable error code (e.g., AUTH-VAL-001)
 *   data:       T | null,            // Response data or null for errors
 *   details:    string[] | null,     // Array of error details (validation errors)
 *   meta:       PaginationMeta | null,
 *   timestamp:  string,              // ISO timestamp
 * }
 */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class ApiResponse<T = any> {
  status: 'success' | 'error' | 'warning';
  statusCode: number;
  message: string;
  errorCode: string | null;
  data: T | null;
  details: string[] | null;
  meta: PaginationMeta | null;
  timestamp: string;

  constructor(
    status: 'success' | 'error' | 'warning',
    statusCode: number,
    message: string,
    data: T | null = null,
    errorCode: string | null = null,
    details: string[] | null = null,
    meta: PaginationMeta | null = null,
  ) {
    this.status = status;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
    this.errorCode = errorCode;
    this.details = details;
    this.meta = meta;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Success response (200 OK)
   */
  static ok<T>(data: T, message = 'Success'): ApiResponse<T> {
    return new ApiResponse('success', 200, message, data);
  }

  /**
   * Paginated success response (200 OK)
   */
  static paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number,
    message = 'Success',
  ): ApiResponse<{ items: T[] }> {
    const totalPages = Math.ceil(total / limit);
    const meta = { page, limit, total, totalPages };
    return new ApiResponse(
      'success',
      200,
      message,
      { items },
      null,
      null,
      meta,
    );
  }

  /**
   * Validation error response (400 Bad Request)
   */
  static validationError(
    errorCode: string,
    message: string,
    details?: string[] | null,
  ): ApiResponse {
    return new ApiResponse('error', 400, message, null, errorCode, details);
  }

  /**
   * Not found error response (404 Not Found)
   */
  static notFound(errorCode: string, message: string): ApiResponse {
    return new ApiResponse('error', 404, message, null, errorCode);
  }

  /**
   * Bad request error response (400 Bad Request)
   */
  static badRequest(
    errorCode: string,
    message: string,
    details?: string[] | null,
  ): ApiResponse {
    return new ApiResponse('error', 400, message, null, errorCode, details);
  }

  /**
   * Conflict error response (409 Conflict)
   */
  static conflict(errorCode: string, message: string): ApiResponse {
    return new ApiResponse('error', 409, message, null, errorCode);
  }

  /**
   * Unauthorized error response (401 Unauthorized)
   */
  static unauthorized(errorCode: string, message: string): ApiResponse {
    return new ApiResponse('error', 401, message, null, errorCode);
  }

  /**
   * Forbidden error response (403 Forbidden)
   */
  static forbidden(errorCode: string, message: string): ApiResponse {
    return new ApiResponse('error', 403, message, null, errorCode);
  }

  /**
   * Internal server error response (500 Internal Server Error)
   */
  static internalError(
    message = 'Internal server error',
    errorCode = 'GEN-ERR-005',
  ): ApiResponse {
    return new ApiResponse('error', 500, message, null, errorCode);
  }

  /**
   * Generic error response with custom status code
   */
  static error(
    statusCode: number,
    message: string,
    errorCode: string,
    details?: string[] | null,
  ): ApiResponse {
    return new ApiResponse(
      'error',
      statusCode,
      message,
      null,
      errorCode,
      details,
    );
  }
}
